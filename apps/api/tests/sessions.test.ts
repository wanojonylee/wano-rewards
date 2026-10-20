import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-sessions-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX, login } = await import("./helpers.ts");
const ctx = await createTestContext();
const fixtures = seedFixtures(ctx.db);

after(async () => {
  await ctx.close();
});

test("start session, simulate three deposits, complete and credit exactly once", async () => {
  const user = await login(ctx.request);
  const started = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.onlineMachineCode, source: "qr" });

  assert.equal(started.status, 201);
  assert.equal(started.body.session.status, "active");
  assert.equal(started.body.session.machine.code, fixtures.onlineMachineCode);
  assert.equal(started.body.pollAfterMs, 1500);
  assert.ok(Date.parse(started.body.session.expiresAt) > Date.now());
  const sessionId = started.body.session.id;

  const duplicateStart = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.onlineMachineCode });
  assert.equal(duplicateStart.status, 409);
  assert.equal(duplicateStart.body.error.code, "SESSION_ALREADY_ACTIVE");

  let expectedPoints = 0;
  let expectedCashback = 0;
  for (const material of ["PET", "ALUMINUM", "GLASS"]) {
    const deposit = await ctx.request
      .post(`${PREFIX}/sessions/${sessionId}/simulate-deposit`)
      .set(user.auth)
      .send({ material });
    assert.equal(deposit.status, 200);
    assert.equal(deposit.body.deposit.accepted, true);
    assert.equal(deposit.body.deposit.material, material);
    assert.ok(deposit.body.deposit.points > 0);
    expectedPoints += deposit.body.deposit.points;
    expectedCashback += deposit.body.deposit.cashbackCents;
  }

  const mid = await ctx.request.get(`${PREFIX}/sessions/${sessionId}`).set(user.auth);
  assert.equal(mid.status, 200);
  assert.equal(mid.body.session.totals.items, 3);
  assert.equal(mid.body.session.totals.points, expectedPoints);
  assert.equal(mid.body.session.deposits.length, 3);

  const completed = await ctx.request
    .post(`${PREFIX}/sessions/${sessionId}/complete`)
    .set(user.auth)
    .send({});
  assert.equal(completed.status, 200);
  assert.equal(completed.body.session.status, "completed");
  assert.equal(completed.body.session.totals.points, expectedPoints);
  assert.equal(completed.body.session.totals.cashbackCents, expectedCashback);
  assert.ok(completed.body.session.receipt.code.startsWith("REC-"));

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.points, expectedPoints);
  assert.equal(me.body.wallet.creditCents, expectedCashback);
  assert.equal(me.body.wallet.withdrawableCents, expectedCashback);
  assert.equal(me.body.stats.itemsTotal, 3);
  assert.equal(me.body.stats.sessionsTotal, 1);

  // Ledger is the source of truth and must reconcile with the wallet.
  const ledger = ctx.db.get<{ points: number; credit: number; withdrawable: number; entries: number }>(
    `SELECT COALESCE(SUM(points_delta), 0) AS points,
            COALESCE(SUM(credit_delta_cents), 0) AS credit,
            COALESCE(SUM(withdrawable_delta_cents), 0) AS withdrawable,
            COUNT(*) AS entries
     FROM ledger_entries WHERE user_id = ?`,
    [user.user.id],
  );
  assert.equal(ledger?.points, me.body.wallet.points);
  assert.equal(ledger?.credit, me.body.wallet.creditCents);
  assert.equal(ledger?.withdrawable, me.body.wallet.withdrawableCents);
  assert.equal(ledger?.entries, 1, "one session = one ledger entry");

  const lastEntry = ctx.db.get<{ balance_after_points: number }>(
    "SELECT balance_after_points FROM ledger_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    [user.user.id],
  );
  assert.equal(lastEntry?.balance_after_points, expectedPoints);

  // Completing again must not double-credit.
  const again = await ctx.request
    .post(`${PREFIX}/sessions/${sessionId}/complete`)
    .set(user.auth)
    .send({});
  assert.equal(again.status, 200);
  assert.equal(again.body.session.status, "completed");
  const meAgain = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAgain.body.wallet.points, expectedPoints);
  assert.equal(meAgain.body.wallet.creditCents, expectedCashback);
});

test("machines that are full or in maintenance are rejected", async () => {
  const user = await login(ctx.request);

  const full = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.fullMachineCode });
  assert.equal(full.status, 409);
  assert.equal(full.body.error.code, "MACHINE_FULL");

  const maintenance = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.maintenanceMachineCode });
  assert.equal(maintenance.status, 409);
  assert.equal(maintenance.body.error.code, "MACHINE_UNAVAILABLE");
});

test("machine ingest is idempotent by eventId and rejects bad weights", async () => {
  const user = await login(ctx.request);
  const started = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.onlineMachineCode });
  const sessionId = started.body.session.id as string;

  const sessionRow = ctx.db.get<{ token: string }>("SELECT token FROM sessions WHERE id = ?", [sessionId]);
  assert.ok(sessionRow?.token);

  const eventId = randomUUID();
  const payload = {
    machineCode: fixtures.onlineMachineCode,
    sessionToken: sessionRow?.token,
    eventId,
    occurredAt: new Date().toISOString(),
    items: [
      {
        gtin: "7891000100103",
        material: "PET",
        weightGrams: 28,
        accepted: true,
        rejectReason: null,
        skuName: "Água Crystal 500ml",
      },
      {
        gtin: "7896045500106",
        material: "GLASS",
        weightGrams: 3200,
        accepted: true,
        rejectReason: null,
        skuName: "Garrafa pesada",
      },
    ],
  };

  const unauthorized = await ctx.request.post(`${PREFIX}/ingest/deposits`).send(payload);
  assert.equal(unauthorized.status, 401);

  const ingested = await ctx.request
    .post(`${PREFIX}/ingest/deposits`)
    .set("X-Machine-Key", "mk_test_online_key")
    .send(payload);
  assert.equal(ingested.status, 201);
  assert.equal(ingested.body.accepted, 1);
  assert.equal(ingested.body.rejected, 1);
  assert.ok(ingested.body.pointsAwarded > 0);
  assert.ok(ingested.body.cashbackCents > 0);

  const replay = await ctx.request
    .post(`${PREFIX}/ingest/deposits`)
    .set("X-Machine-Key", "mk_test_online_key")
    .send(payload);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);

  const session = await ctx.request.get(`${PREFIX}/sessions/${sessionId}`).set(user.auth);
  assert.equal(session.body.session.totals.items, 1);
});
