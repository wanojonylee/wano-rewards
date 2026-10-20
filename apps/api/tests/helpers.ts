/**
 * Test harness: each test file runs in its own Node process with a unique
 * SQLite database (set DB_PATH before importing the helper).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import supertest from "supertest";
import type { Express } from "express";

export const PREFIX = "/api/v1";

export interface TestContext {
  app: Express;
  request: ReturnType<typeof supertest>;
  db: typeof import("../src/db/index.ts");
  close: () => Promise<void>;
}

export interface Fixtures {
  condoId: string;
  buildingId: string;
  onlineMachineCode: string;
  onlineMachineId: string;
  fullMachineCode: string;
  maintenanceMachineCode: string;
  rewardCheapId: string;
  rewardPhysicalId: string;
  rewardOutOfStockId: string;
}

export async function createTestContext(): Promise<TestContext> {
  const db = await import("../src/db/index.ts");
  db.initDb();
  const { createApp } = await import("../src/app.ts");
  const { env } = await import("../src/env.ts");
  const app = createApp();
  const request = supertest(app);

  return {
    app,
    request,
    db,
    close: async () => {
      db.closeDb();
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          fs.rmSync(`${env.dbPath}${suffix}`, { force: true });
        } catch {
          // best effort
        }
      }
    },
  };
}

export function seedFixtures(db: TestContext["db"]): Fixtures {
  const now = new Date().toISOString();
  const condoId = "cnd_test";
  const buildingId = "bld_test";

  db.run(
    `INSERT INTO condos (id, name, city, state, neighborhood, address, latitude, longitude, created_at)
     VALUES (?, 'Edifício Teste', 'São Paulo', 'SP', 'Pinheiros', 'Rua Teste, 100', -23.56, -46.69, ?)`,
    [condoId, now],
  );
  db.run("INSERT INTO buildings (id, condo_id, name, address, created_at) VALUES (?, ?, 'Torre Teste', 'Rua Teste, 100', ?)", [
    buildingId,
    condoId,
    now,
  ]);

  const machines = [
    { id: "mac_online", code: "RVM-TEST-001", status: "online", fill: 20, key: "mk_test_online_key" },
    { id: "mac_full", code: "RVM-TEST-FULL", status: "full", fill: 100, key: "mk_test_full_key" },
    { id: "mac_maint", code: "RVM-TEST-MAINT", status: "maintenance", fill: 50, key: "mk_test_maint_key" },
  ];
  for (const machine of machines) {
    db.run(
      `INSERT INTO machines (id, code, name, condo_id, building_id, address, latitude, longitude,
         distance_meters, status, fill_percent, hours, api_key, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Rua Teste, 100', -23.56, -46.69, 50, ?, ?, '24h', ?, ?, ?, ?)`,
      [machine.id, machine.code, machine.code, condoId, buildingId, machine.status, machine.fill, machine.key, now, now, now],
    );
    for (const material of ["PET", "ALUMINUM", "GLASS", "HDPE", "PP", "PS_HIPS"]) {
      db.run("INSERT INTO machine_materials (machine_id, material) VALUES (?, ?)", [machine.id, material]);
    }
  }

  const rewards = [
    { id: "rwd_test_cheap", title: "Café de teste", category: "voucher", points: 100, stock: 5, delivery: 0, value: 500 },
    { id: "rwd_test_physical", title: "Ecobag de teste", category: "product", points: 200, stock: 3, delivery: 1, value: 1500 },
    { id: "rwd_test_out", title: "Esgotado", category: "voucher", points: 50, stock: 0, delivery: 0, value: 0 },
    { id: "rwd_test_expensive", title: "Experiência cara", category: "experience", points: 50_000, stock: 10, delivery: 0, value: 10_000 },
  ];
  for (const reward of rewards) {
    db.run(
      `INSERT INTO rewards (id, slug, title, subtitle, category, partner, points_cost, value_cents, image_key,
         stock, is_new, highlight, terms, expires_at, requires_delivery, active, created_at, updated_at)
       VALUES (?, ?, ?, 'Teste', ?, 'Parceiro Teste', ?, ?, 'coffee', ?, 0, 0, 'Termos de teste', NULL, ?, 1, ?, ?)`,
      [
        reward.id,
        reward.id,
        reward.title,
        reward.category,
        reward.points,
        reward.value,
        reward.stock,
        reward.delivery,
        now,
        now,
      ],
    );
  }

  return {
    condoId,
    buildingId,
    onlineMachineCode: "RVM-TEST-001",
    onlineMachineId: "mac_online",
    fullMachineCode: "RVM-TEST-FULL",
    maintenanceMachineCode: "RVM-TEST-MAINT",
    rewardCheapId: "rwd_test_cheap",
    rewardPhysicalId: "rwd_test_physical",
    rewardOutOfStockId: "rwd_test_out",
  };
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: { id: string; name: string | null; phone: string | null };
  auth: { Authorization: string };
}

export async function login(request: TestContext["request"], identifier?: string): Promise<LoginResult> {
  const phone = identifier ?? `+55119${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}`;
  const otp = await request.post(`${PREFIX}/auth/request-otp`).send({ identifier: phone });
  if (otp.status !== 200) throw new Error(`request-otp failed: ${JSON.stringify(otp.body)}`);
  const verified = await request.post(`${PREFIX}/auth/verify`).send({ identifier: phone, code: "123456" });
  if (verified.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verified.body)}`);
  return {
    token: verified.body.accessToken,
    refreshToken: verified.body.refreshToken,
    user: verified.body.user,
    auth: { Authorization: `Bearer ${verified.body.accessToken}` },
  };
}

export function newPhone(): string {
  return `+5511${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`;
}

export async function fundWallet(
  userId: string,
  amounts: { points?: number; creditCents?: number; withdrawableCents?: number },
): Promise<void> {
  const { applyLedger } = await import("../src/services/ledger.ts");
  applyLedger({
    userId,
    pointsDelta: amounts.points ?? 0,
    creditDeltaCents: amounts.creditCents ?? 0,
    withdrawableDeltaCents: amounts.withdrawableCents ?? 0,
    type: "campaign_bonus",
    refType: "test",
    refId: randomUUID(),
    description: "Crédito de teste",
    idempotencyKey: `test:${randomUUID()}`,
  });
}

export function setUserCondo(db: TestContext["db"], userId: string, condoId: string, buildingId: string): void {
  db.run("UPDATE users SET condo_id = ?, building_id = ? WHERE id = ?", [condoId, buildingId, userId]);
}

export function setUserRole(db: TestContext["db"], userId: string, role: string): void {
  db.run("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
}
