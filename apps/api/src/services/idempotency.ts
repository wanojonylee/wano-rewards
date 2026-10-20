/**
 * Idempotency for mutating money/points endpoints.
 * Stores { request hash, response JSON } for 24h keyed by (user, endpoint, key).
 * A replay with the same key + same body returns the original response with
 * `replayed: true`; the same key with a different body is a 409 conflict.
 */
import { get, run } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { sha256Hex } from "../utils/crypto.ts";
import { newId } from "../utils/ids.ts";
import { addMinutes, nowIso } from "../utils/time.ts";

interface IdempotencyRow {
  id: string;
  request_hash: string;
  response_json: string;
  status_code: number;
  expires_at: string;
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function lookup<T>(
  userId: string,
  endpoint: string,
  key: string,
  requestHash: string,
): IdempotentResult<T> | null {
  const existing = get<IdempotencyRow>(
    "SELECT * FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND key = ?",
    [userId, endpoint, key],
  );
  if (!existing) return null;
  if (existing.request_hash !== requestHash) {
    throw new ApiError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency-Key já utilizada com outro conteúdo",
      409,
    );
  }
  const body = JSON.parse(existing.response_json) as T & { replayed?: boolean };
  return { status: existing.status_code, body: { ...body, replayed: true }, replayed: true };
}

/**
 * Persists the response. Returns the stored copy when another request won the
 * race, otherwise null.
 */
function store<T>(
  userId: string,
  endpoint: string,
  key: string,
  requestHash: string,
  result: { status: number; body: T },
  now: string,
): IdempotentResult<T> | null {
  const insert = run(
    `INSERT INTO idempotency_keys (id, key, user_id, endpoint, request_hash, response_json, status_code, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, endpoint, key) DO NOTHING`,
    [
      newId("idm"),
      key,
      userId,
      endpoint,
      requestHash,
      JSON.stringify(result.body),
      result.status,
      now,
      addMinutes(24 * 60),
    ],
  );
  if (insert.changes > 0) return null;
  const existing = get<IdempotencyRow>(
    "SELECT * FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND key = ?",
    [userId, endpoint, key],
  );
  if (!existing) return null;
  return {
    status: existing.status_code,
    body: { ...(JSON.parse(existing.response_json) as T), replayed: true },
    replayed: true,
  };
}

function prepareKey(rawKey: string | undefined): string | null {
  const key = rawKey?.trim();
  if (!key) return null;
  if (key.length > 200) {
    throw new ApiError("VALIDATION_ERROR", "Idempotency-Key inválido", 400);
  }
  return key;
}

function cleanup(now: string): void {
  run("DELETE FROM idempotency_keys WHERE expires_at < ?", [now]);
}

export interface IdempotencyOptions<T> {
  key: string | undefined;
  userId: string;
  endpoint: string;
  body: unknown;
  execute: () => { status: number; body: T };
}

export function withIdempotency<T>(options: IdempotencyOptions<T>): IdempotentResult<T> {
  const key = prepareKey(options.key);
  if (!key) {
    return { ...options.execute(), replayed: false };
  }
  const now = nowIso();
  cleanup(now);
  const requestHash = sha256Hex(stableStringify(options.body));
  const existing = lookup<T>(options.userId, options.endpoint, key, requestHash);
  if (existing) return existing;

  const result = options.execute();
  return store(options.userId, options.endpoint, key, requestHash, result, now) ?? {
    ...result,
    replayed: false,
  };
}

export interface AsyncIdempotencyOptions<T> {
  key: string | undefined;
  userId: string;
  endpoint: string;
  body: unknown;
  execute: () => Promise<{ status: number; body: T }>;
}

/** Async variant for endpoints that call an external provider (Stripe). */
export async function withIdempotencyAsync<T>(
  options: AsyncIdempotencyOptions<T>,
): Promise<IdempotentResult<T>> {
  const key = prepareKey(options.key);
  if (!key) {
    return { ...(await options.execute()), replayed: false };
  }
  const now = nowIso();
  cleanup(now);
  const requestHash = sha256Hex(stableStringify(options.body));
  const existing = lookup<T>(options.userId, options.endpoint, key, requestHash);
  if (existing) return existing;

  const result = await options.execute();
  return store(options.userId, options.endpoint, key, requestHash, result, now) ?? {
    ...result,
    replayed: false,
  };
}
