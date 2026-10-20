import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-lgpd-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX, login, fundWallet } = await import("./helpers.ts");
const ctx = await createTestContext();
seedFixtures(ctx.db);

after(async () => {
  await ctx.close();
});

test("LGPD export writes a JSON portability file", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 250, creditCents: 300, withdrawableCents: 300 });

  const res = await ctx.request.get(`${PREFIX}/me/export`).set(user.auth);
  assert.equal(res.status, 202);
  assert.ok(res.body.jobId);

  const { env } = await import("../src/env.ts");
  const file = path.join(env.apiRoot, "data", "exports", `${res.body.jobId}.json`);
  assert.equal(fs.existsSync(file), true, "export file must exist");
  const payload = JSON.parse(fs.readFileSync(file, "utf8")) as {
    user: { id: string };
    wallet: { points: number };
    ledger: unknown[];
    format: string;
  };
  assert.equal(payload.format, "recio.lgpd.export.v1");
  assert.equal(payload.user.id, user.user.id);
  assert.equal(payload.wallet.points, 250);
  assert.ok(Array.isArray(payload.ledger) && payload.ledger.length >= 1);

  const audit = ctx.db.get<{ action: string }>(
    "SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'lgpd.export'",
    [user.user.id],
  );
  assert.ok(audit);
});

test("consent and profile updates", async () => {
  const user = await login(ctx.request);
  const consent = await ctx.request
    .post(`${PREFIX}/me/consent`)
    .set(user.auth)
    .send({ lgpd: true, marketing: true });
  assert.equal(consent.status, 200);
  assert.equal(consent.body.consent.marketingOptIn, true);
  assert.ok(consent.body.consent.lgpdAt);

  const patched = await ctx.request
    .patch(`${PREFIX}/me`)
    .set(user.auth)
    .send({ name: "Pessoa Teste", marketingOptIn: true });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.name, "Pessoa Teste");
  assert.equal(patched.body.consent.marketingOptIn, true);

  const invalid = await ctx.request.patch(`${PREFIX}/me`).set(user.auth).send({ email: "nope" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
});

test("account deletion requires confirmation, revokes access and pseudonymizes later", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 100 });

  const wrong = await ctx.request.delete(`${PREFIX}/me`).set(user.auth).send({ confirm: "delete" });
  assert.equal(wrong.status, 400);

  const deleted = await ctx.request.delete(`${PREFIX}/me`).set(user.auth).send({ confirm: "DELETE" });
  assert.equal(deleted.status, 202);
  assert.equal(deleted.body.requested, true);
  assert.ok(deleted.body.pseudonymizeAfter);

  const blocked = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(blocked.status, 401, "deleted accounts must lose access immediately");

  const row = ctx.db.get<{ deleted_at: string | null; marketing_opt_in: number; pseudonymize_after: string }>(
    "SELECT deleted_at, marketing_opt_in, pseudonymize_after FROM users WHERE id = ?",
    [user.user.id],
  );
  assert.ok(row?.deleted_at);
  assert.equal(row?.marketing_opt_in, 0);

  // Simulate the 30-day grace period elapsing.
  ctx.db.run("UPDATE users SET pseudonymize_after = ? WHERE id = ?", [
    new Date(Date.now() - 86_400_000).toISOString(),
    user.user.id,
  ]);
  const { pseudonymizeDueUsers } = await import("../src/services/lgpd.ts");
  const count = pseudonymizeDueUsers();
  assert.equal(count, 1);

  const anonymized = ctx.db.get<{ name: string; phone: string | null; email: string | null; pseudonymized: number }>(
    "SELECT name, phone, email, pseudonymized FROM users WHERE id = ?",
    [user.user.id],
  );
  assert.equal(anonymized?.name, "Usuário removido");
  assert.equal(anonymized?.phone, null);
  assert.equal(anonymized?.email, null);
  assert.equal(anonymized?.pseudonymized, 1);

  const notifications = ctx.db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
    [user.user.id],
  );
  assert.equal(notifications?.total, 0);
});
