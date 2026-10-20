/**
 * SQLite access layer built on the built-in `node:sqlite` module.
 * - WAL journal, foreign keys ON, busy timeout configured on open.
 * - Prepared statement cache + synchronous transaction helper.
 * - Schema is applied idempotently on first access.
 */
import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_ROOT, env } from "../env.ts";
import { logger } from "../logger.ts";

export type SqlValue = string | number | bigint | null | Uint8Array;
export type SqlParams = readonly SqlValue[];
export type SqlParamInput = SqlValue | boolean | undefined | Date;

let database: DatabaseSync | null = null;
let transactionDepth = 0;
const statementCache = new Map<string, StatementSync>();

export function bind(value: SqlParamInput): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function schemaPath(): string {
  const beside = path.join(API_ROOT, "dist", "db", "schema.sql");
  const source = path.join(API_ROOT, "src", "db", "schema.sql");
  // Prefer the file next to the running module (dist or src), then fall back.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const local = path.join(moduleDir, "schema.sql");
  if (fs.existsSync(local)) return local;
  if (fs.existsSync(beside)) return beside;
  return source;
}

function configure(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");
}

function applySchema(db: DatabaseSync): void {
  const file = schemaPath();
  const sql = fs.readFileSync(file, "utf8");
  db.exec(sql);
  migrateSchema(db, sql);
  const version = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
  if (!version || !version.user_version || version.user_version < 2) {
    db.exec("PRAGMA user_version = 2;");
  }
}

/**
 * Idempotent schema migration for existing databases.
 *
 * SQLite cannot ALTER a CHECK constraint, so adding the `failed` payout status
 * requires a table rebuild. We only do that when the stored DDL is detected as
 * legacy; new databases already come from schema.sql with every column. The
 * rebuild copies every shared column, so no data (or legacy `rejected` rows)
 * is lost, and runs with foreign keys disabled for the duration only.
 */
const PAYOUT_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: "provider", ddl: "TEXT NOT NULL DEFAULT 'mock'" },
  { name: "provider_payout_id", ddl: "TEXT" },
  { name: "failure_reason", ddl: "TEXT" },
  { name: "retry_of", ddl: "TEXT" },
  { name: "refunded_at", ddl: "TEXT" },
];

const PAYOUT_INDEXES: readonly string[] = [
  "CREATE INDEX IF NOT EXISTS idx_payouts_user_created ON payouts(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status)",
  "CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_payouts_provider_payout ON payouts(provider, provider_payout_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_active_retry ON payouts(retry_of) WHERE retry_of IS NOT NULL AND status IN ('pending','paid')",
];

function payoutsTableSql(db: DatabaseSync): string | null {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payouts'")
    .get() as { sql?: string } | undefined;
  return row?.sql ?? null;
}

function tableColumns(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function rebuildPayoutsTable(db: DatabaseSync, schemaSql: string): void {
  const create = schemaSql.match(/CREATE TABLE IF NOT EXISTS payouts \([\s\S]*?\n\);/);
  if (!create) {
    throw new Error("schema.sql is missing the payouts table definition");
  }
  const migratedDdl = create[0].replace(
    "CREATE TABLE IF NOT EXISTS payouts",
    "CREATE TABLE IF NOT EXISTS payouts_migrated",
  );
  const oldColumns = tableColumns(db, "payouts");
  const quoted = (columns: string[]): string => columns.map((column) => `"${column}"`).join(", ");

  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.exec("BEGIN IMMEDIATE;");
    db.exec("DROP TABLE IF EXISTS payouts_migrated;");
    db.exec(migratedDdl);
    const newColumns = tableColumns(db, "payouts_migrated");
    const shared = oldColumns.filter((column) => newColumns.includes(column));
    if (shared.length === 0) throw new Error("payouts migration found no shared columns");
    db.exec(
      `INSERT INTO payouts_migrated (${quoted(shared)}) SELECT ${quoted(shared)} FROM payouts;`,
    );
    db.exec("DROP TABLE payouts;");
    db.exec("ALTER TABLE payouts_migrated RENAME TO payouts;");
    db.exec("COMMIT;");
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // transaction already rolled back
    }
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function migrateSchema(db: DatabaseSync, schemaSql: string): void {
  if (!payoutsTableSql(db)) return;
  const existing = new Set(tableColumns(db, "payouts"));
  for (const column of PAYOUT_COLUMNS) {
    if (existing.has(column.name)) continue;
    db.exec(`ALTER TABLE payouts ADD COLUMN ${column.name} ${column.ddl};`);
    existing.add(column.name);
  }

  const ddl = payoutsTableSql(db) ?? "";
  if (!ddl.includes("'failed'")) {
    rebuildPayoutsTable(db, schemaSql);
    logger.info("payouts table migrated to support failed status and provider columns");
  }

  for (const statement of PAYOUT_INDEXES) db.exec(`${statement};`);
}

export function getDb(): DatabaseSync {
  if (database) return database;
  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  const db = new DatabaseSync(env.dbPath);
  configure(db);
  applySchema(db);
  database = db;
  logger.debug("sqlite ready", { path: env.dbPath, mode: env.mode });
  return db;
}

/** Opens (or reopens) the database at env.dbPath — used by tests and seed. */
export function initDb(): DatabaseSync {
  closeDb();
  return getDb();
}

export function closeDb(): void {
  statementCache.clear();
  if (database) {
    try {
      database.close();
    } catch {
      // already closed
    }
    database = null;
  }
  transactionDepth = 0;
}

function prepare(sql: string): StatementSync {
  const cached = statementCache.get(sql);
  if (cached) return cached;
  const statement = getDb().prepare(sql);
  statementCache.set(sql, statement);
  return statement;
}

export function all<T>(sql: string, params: SqlParams = []): T[] {
  return prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, params: SqlParams = []): T | undefined {
  return prepare(sql).get(...params) as T | undefined;
}

export function run(
  sql: string,
  params: SqlParams = [],
): { changes: number; lastInsertRowid: number } {
  const result = prepare(sql).run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

/** Streaming iterator for large result sets (admin CSV). */
export function iterate<T>(sql: string, params: SqlParams = []): IterableIterator<T> {
  return prepare(sql).iterate(...params) as IterableIterator<T>;
}

export function exec(sql: string): void {
  getDb().exec(sql);
}

/**
 * Runs `fn` inside a single SQLite transaction. Nested calls join the outer
 * transaction so the ledger service can be composed with domain services.
 */
export function withTransaction<T>(fn: () => T): T {
  if (transactionDepth > 0) return fn();
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  transactionDepth += 1;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // transaction already rolled back
    }
    throw error;
  } finally {
    transactionDepth -= 1;
  }
}

export function isInsideTransaction(): boolean {
  return transactionDepth > 0;
}

/** Test/dev helper: counts rows in a table. */
export function countRows(table: string): number {
  const row = get<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`);
  return row?.total ?? 0;
}
