import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-payouts-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";
process.env.PIX_PROVIDER = "mock";

const { createTestContext, seedFixtures, PREFIX, login, fundWallet, setUserRole } = await import("./helpers.ts");
import type { LoginResult } from "./helpers.ts";
const ctx = await createTestContext();
seedFixtures(ctx.db);

after(async () => {
  await ctx.close();
});

async function adminLogin(): Promise<LoginResult> {
  const admin = await login(ctx.request);
  setUserRole(ctx.db, admin.user.id, "admin");
  return admin;
}

function createPayoutRequest(
  user: LoginResult,
  amountCents: number,
  pixKey = "user@example.com",
  idempotencyKey?: string,
) {
  const request = ctx.request
    .post(`${PREFIX}/payouts`)
    .set(user.auth);
  if (idempotencyKey) request.set("Idempotency-Key", idempotencyKey);
  return request.send({ amountCents, pixKey, pixKeyType: "email" });
}

function pixWebhook(event: Record<string, unknown>) {
  return ctx.request
    .post(`${PREFIX}/webhooks/pix`)
    .set("Content-Type", "application/json")
    .send(JSON.stringify(event));
}

function payoutLedger(payoutId: string) {
  return ctx.db.all<{ type: string; credit_delta_cents: number; withdrawable_delta_cents: number }>(
    "SELECT type, credit_delta_cents, withdrawable_delta_cents FROM ledger_entries WHERE ref_type = 'payout' AND ref_id = ? ORDER BY created_at, rowid",
    [payoutId],
  );
}

function refundLedgerCount(payoutId: string): number {
  return (
    ctx.db.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM ledger_entries WHERE type = 'payout_refund' AND ref_type = 'payout' AND ref_id = ?",
      [payoutId],
    )?.total ?? 0
  );
}

test("payout applies fee, debits the full amount and is idempotent", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 100, creditCents: 5000, withdrawableCents: 5000 });

  const tooSmall = await createPayoutRequest(user, 1000);
  assert.equal(tooSmall.status, 400);
  assert.equal(tooSmall.body.error.code, "PAYOUT_TOO_SMALL");

  const tooLarge = await createPayoutRequest(user, 50_001);
  assert.equal(tooLarge.status, 400);
  assert.equal(tooLarge.body.error.code, "PAYOUT_TOO_LARGE");

  const idem = randomUUID();
  const ok = await createPayoutRequest(user, 2500, "user@example.com", idem);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.payout.status, "pending");
  assert.equal(ok.body.payout.amountCents, 2500);
  assert.equal(ok.body.payout.feeCents, 150);
  assert.equal(ok.body.payout.netCents, 2350);
  assert.equal(ok.body.payout.pixKeyMasked, "us**@example.com");
  assert.equal(ok.body.payout.provider, "mock");
  assert.match(ok.body.payout.providerPayoutId, /^mock_pix_/);
  assert.equal(ok.body.payout.failureReason, null);

  const entries = payoutLedger(ok.body.payout.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.type, "payout");
  assert.equal(entries[0]?.credit_delta_cents, -2500, "ledger debits the gross amount");
  assert.equal(entries[0]?.withdrawable_delta_cents, -2500);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.withdrawableCents, 2500);
  assert.equal(me.body.wallet.creditCents, 2500);

  const replay = await createPayoutRequest(user, 2500, "user@example.com", idem);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.payout.id, ok.body.payout.id);
  const meAfter = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfter.body.wallet.withdrawableCents, 2500, "replay must not debit again");
  const count = ctx.db.get<{ total: number }>("SELECT COUNT(*) AS total FROM payouts WHERE user_id = ?", [
    user.user.id,
  ]);
  assert.equal(count?.total, 1, "idempotent replay creates a single payout");

  const insufficient = await createPayoutRequest(user, 3000);
  assert.equal(insufficient.status, 409);
  assert.equal(insufficient.body.error.code, "INSUFFICIENT_CREDIT");

  const list = await ctx.request.get(`${PREFIX}/payouts`).set(user.auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].feeCents, 150);
  assert.equal(list.body.items[0].netCents, 2350);
});

test("daily payout cap is enforced and admin can mark paid", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 60_000, withdrawableCents: 60_000 });

  const first = await createPayoutRequest(user, 40_000, "+5511999990000");
  assert.equal(first.status, 201);

  const second = await createPayoutRequest(user, 20_000, "+5511999990000");
  assert.equal(second.status, 400);
  assert.equal(second.body.error.code, "PAYOUT_DAILY_CAP");

  const admin = await adminLogin();
  const paid = await ctx.request
    .post(`${PREFIX}/admin/payouts/${first.body.payout.id}/paid`)
    .set(admin.auth)
    .send({ note: "Pix enviado", providerPayoutId: "manual_pix_123" });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.payout.status, "paid");
  assert.ok(paid.body.payout.paidAt);
  assert.equal(paid.body.payout.providerPayoutId, "manual_pix_123");

  const audit = ctx.db.get<{ action: string }>(
    "SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1",
    [first.body.payout.id],
  );
  assert.equal(audit?.action, "payout.paid");
});

test("PIX webhook marks a pending payout paid and dedupes replays", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 5000, withdrawableCents: 5000 });
  const created = await createPayoutRequest(user, 2500);
  assert.equal(created.status, 201);

  const event = {
    id: `evt_paid_${randomUUID()}`,
    event: "TRANSFER_PAID",
    transfer: {
      id: created.body.payout.providerPayoutId,
      externalReference: created.body.payout.id,
    },
  };

  const webhook = await pixWebhook(event);
  assert.equal(webhook.status, 200);
  assert.equal(webhook.body.received, true);
  assert.equal(webhook.body.duplicate, undefined);
  assert.equal(webhook.body.status, "paid");

  const list = await ctx.request.get(`${PREFIX}/payouts`).set(user.auth);
  assert.equal(list.body.items[0].status, "paid");
  assert.ok(list.body.items[0].paidAt);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 2500);
  assert.equal(me.body.wallet.withdrawableCents, 2500);

  const notifications = ctx.db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND type = 'payout_paid'",
    [user.user.id],
  );
  assert.equal(notifications?.total, 1);

  const replay = await pixWebhook(event);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  const meAfter = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfter.body.wallet.creditCents, 2500);
  const notificationsAfter = ctx.db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND type = 'payout_paid'",
    [user.user.id],
  );
  assert.equal(notificationsAfter?.total, 1, "replayed paid event must not notify twice");
});

test("failed PIX webhook refunds exactly once and ignores later failure events", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 5000, withdrawableCents: 5000 });
  const created = await createPayoutRequest(user, 2500);
  const payoutId = created.body.payout.id as string;
  const providerId = created.body.payout.providerPayoutId as string;

  const meBefore = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meBefore.body.wallet.creditCents, 2500);

  const failedEvent = {
    id: `evt_failed_${randomUUID()}`,
    event: "TRANSFER_FAILED",
    transfer: { id: providerId, externalReference: payoutId },
    failureReason: "Conta de destino inválida",
  };
  const webhook = await pixWebhook(failedEvent);
  assert.equal(webhook.status, 200);
  assert.equal(webhook.body.status, "failed");

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 5000, "failed payout refunds the gross amount");
  assert.equal(me.body.wallet.withdrawableCents, 5000);

  const refunds = payoutLedger(payoutId).filter((entry) => entry.type === "payout_refund");
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0]?.credit_delta_cents, 2500);
  assert.equal(refunds[0]?.withdrawable_delta_cents, 2500);

  const payoutRow = ctx.db.get<{ status: string; failure_reason: string; refunded_at: string }>(
    "SELECT status, failure_reason, refunded_at FROM payouts WHERE id = ?",
    [payoutId],
  );
  assert.equal(payoutRow?.status, "failed");
  assert.match(payoutRow?.failure_reason ?? "", /Conta de destino inválida/);
  assert.ok(payoutRow?.refunded_at);

  const replay = await pixWebhook(failedEvent);
  assert.equal(replay.body.duplicate, true);
  const meAfterReplay = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfterReplay.body.wallet.creditCents, 5000, "replayed event must not refund twice");
  assert.equal(refundLedgerCount(payoutId), 1);

  // A different event id for the same transfer must also be a no-op.
  const secondFailure = await pixWebhook({
    id: `evt_failed_${randomUUID()}`,
    event: "TRANSFER_FAILED",
    transfer: { id: providerId },
  });
  assert.equal(secondFailure.status, 200);
  assert.equal(secondFailure.body.ignored, true);
  const meAfterSecond = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfterSecond.body.wallet.creditCents, 5000);
  assert.equal(refundLedgerCount(payoutId), 1);
  const failedNotifications = ctx.db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND type = 'payout_failed'",
    [user.user.id],
  );
  assert.equal(failedNotifications?.total, 1);
});

test("mock provider deterministic failure trigger refunds immediately", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 5000, withdrawableCents: 5000 });

  const created = await createPayoutRequest(user, 2500, "user@fail.test");
  assert.equal(created.status, 201);
  assert.equal(created.body.payout.status, "failed");
  assert.match(created.body.payout.failureReason ?? "", /simulada/i);
  assert.match(created.body.payout.providerPayoutId ?? "", /^mock_pix_/);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 5000);
  assert.equal(me.body.wallet.withdrawableCents, 5000);
  assert.equal(refundLedgerCount(created.body.payout.id), 1);
});

test("admin payout list paginates with user data and totals; non-admin is forbidden", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 12_000, withdrawableCents: 12_000 });
  const created: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await createPayoutRequest(user, 2000, `list-${index}@example.com`);
    assert.equal(response.status, 201);
    created.push(response.body.payout.id as string);
  }

  const forbidden = await ctx.request.get(`${PREFIX}/admin/payouts`).set(user.auth);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, "FORBIDDEN");

  const admin = await adminLogin();
  const pageOne = await ctx.request
    .get(`${PREFIX}/admin/payouts?status=pending&limit=2`)
    .set(admin.auth);
  assert.equal(pageOne.status, 200);
  assert.equal(pageOne.body.items.length, 2);
  assert.ok(pageOne.body.nextCursor);
  assert.ok(pageOne.body.totals.count >= 3);
  assert.ok(pageOne.body.totals.amountCents >= 6000);
  const item = pageOne.body.items.find((row: { id: string }) => created.includes(row.id));
  assert.ok(item, "created payouts appear in the admin list");
  assert.equal(item.amountCents, 2000);
  assert.equal(item.feeCents, 150);
  assert.equal(item.netCents, 1850);
  assert.equal(item.provider, "mock");
  assert.equal(typeof item.userName === "string" || item.userName === null, true);
  assert.equal(typeof item.userPhone, "string");

  const pageTwo = await ctx.request
    .get(`${PREFIX}/admin/payouts?status=pending&limit=2&cursor=${encodeURIComponent(pageOne.body.nextCursor)}`)
    .set(admin.auth);
  assert.equal(pageTwo.status, 200);
  const ids = new Set([...pageOne.body.items, ...pageTwo.body.items].map((row: { id: string }) => row.id));
  assert.equal(ids.size, pageOne.body.items.length + pageTwo.body.items.length, "pages do not overlap");

  const invalid = await ctx.request.get(`${PREFIX}/admin/payouts?status=nope`).set(admin.auth);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");

  const hidden = await ctx.request.get(`${PREFIX}/admin/payouts`).set({ Authorization: "Bearer invalid" });
  assert.equal(hidden.status, 401);
});

test("admin retry re-debits a failed payout and is idempotent", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 5000, withdrawableCents: 5000 });
  const created = await createPayoutRequest(user, 2500);
  const originalId = created.body.payout.id as string;

  const admin = await adminLogin();
  const failed = await ctx.request
    .post(`${PREFIX}/admin/payouts/${originalId}/fail`)
    .set(admin.auth)
    .send({ reason: "Falha antes do reenvio" });
  assert.equal(failed.body.payout.status, "failed");
  const meAfterFailure = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfterFailure.body.wallet.creditCents, 5000);

  const idem = randomUUID();
  const retried = await ctx.request
    .post(`${PREFIX}/admin/payouts/${originalId}/retry`)
    .set(admin.auth)
    .set("Idempotency-Key", idem)
    .send({});
  assert.equal(retried.status, 201);
  assert.equal(retried.body.payout.status, "pending");
  assert.notEqual(retried.body.payout.id, originalId);
  assert.equal(retried.body.payout.retryOf, originalId);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 2500, "retry re-debits the user");
  assert.equal(me.body.wallet.withdrawableCents, 2500);

  const row = ctx.db.get<{ retry_of: string; status: string }>(
    "SELECT retry_of, status FROM payouts WHERE id = ?",
    [retried.body.payout.id],
  );
  assert.equal(row?.retry_of, originalId);
  assert.equal(row?.status, "pending");

  const replay = await ctx.request
    .post(`${PREFIX}/admin/payouts/${originalId}/retry`)
    .set(admin.auth)
    .set("Idempotency-Key", idem)
    .send({});
  assert.equal(replay.status, 201);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.payout.id, retried.body.payout.id);
  const meAfterReplay = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfterReplay.body.wallet.creditCents, 2500);

  const secondActive = await ctx.request
    .post(`${PREFIX}/admin/payouts/${originalId}/retry`)
    .set(admin.auth)
    .send({});
  assert.equal(secondActive.status, 409);
  assert.equal(secondActive.body.error.code, "PAYOUT_INVALID_STATE");

  const audit = ctx.db.get<{ action: string }>(
    "SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1",
    [retried.body.payout.id],
  );
  assert.equal(audit?.action, "payout.retry");

  // Admin can fail the retry (refund) and retry only failed payouts.
  const failedRetry = await ctx.request
    .post(`${PREFIX}/admin/payouts/${retried.body.payout.id}/fail`)
    .set(admin.auth)
    .send({ reason: "Retentativa recusada pelo banco" });
  assert.equal(failedRetry.status, 200);
  assert.equal(failedRetry.body.payout.status, "failed");
  const meAfterFail = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfterFail.body.wallet.creditCents, 5000);

  const pending = await createPayoutRequest(user, 2500);
  assert.equal(pending.body.payout.status, "pending");
  const invalidRetry = await ctx.request
    .post(`${PREFIX}/admin/payouts/${pending.body.payout.id}/retry`)
    .set(admin.auth)
    .send({});
  assert.equal(invalidRetry.status, 409);

  const forbidden = await ctx.request
    .post(`${PREFIX}/admin/payouts/${originalId}/retry`)
    .set(user.auth)
    .send({});
  assert.equal(forbidden.status, 403);
});

test("admin manual failure refunds once, is idempotent and refuses paid payouts", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { creditCents: 5000, withdrawableCents: 5000 });
  const created = await createPayoutRequest(user, 2500);
  const payoutId = created.body.payout.id as string;
  const admin = await adminLogin();

  const failed = await ctx.request
    .post(`${PREFIX}/admin/payouts/${payoutId}/fail`)
    .set(admin.auth)
    .send({ reason: "Chave PIX bloqueada" });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.payout.status, "failed");
  assert.match(failed.body.payout.failureReason ?? "", /Chave PIX bloqueada/);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 5000);
  assert.equal(refundLedgerCount(payoutId), 1);

  const again = await ctx.request
    .post(`${PREFIX}/admin/payouts/${payoutId}/fail`)
    .set(admin.auth)
    .send({ reason: "ignorar" });
  assert.equal(again.status, 200);
  const meAgain = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAgain.body.wallet.creditCents, 5000);
  assert.equal(refundLedgerCount(payoutId), 1, "manual failure never refunds twice");

  const audit = ctx.db.get<{ action: string }>(
    "SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'payout.fail' LIMIT 1",
    [payoutId],
  );
  assert.equal(audit?.action, "payout.fail");

  const paidPayout = await createPayoutRequest(user, 2000);
  const paid = await ctx.request
    .post(`${PREFIX}/admin/payouts/${paidPayout.body.payout.id}/paid`)
    .set(admin.auth)
    .send({});
  assert.equal(paid.body.payout.status, "paid");
  const cannotFailPaid = await ctx.request
    .post(`${PREFIX}/admin/payouts/${paidPayout.body.payout.id}/fail`)
    .set(admin.auth)
    .send({});
  assert.equal(cannotFailPaid.status, 409);
  assert.equal(cannotFailPaid.body.error.code, "PAYOUT_INVALID_STATE");

  const forbidden = await ctx.request
    .post(`${PREFIX}/admin/payouts/${payoutId}/fail`)
    .set(user.auth)
    .send({});
  assert.equal(forbidden.status, 403);
});

test("reconciliation is balanced, variance-free and counts ledger payouts", async () => {
  const admin = await adminLogin();
  const from = new Date(Date.now() - 86_400_000).toISOString();
  const to = new Date(Date.now() + 86_400_000).toISOString();

  const response = await ctx.request
    .get(`${PREFIX}/admin/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    .set(admin.auth);
  assert.equal(response.status, 200);
  const body = response.body as Record<string, unknown>;
  assert.equal(body.balanced, true);
  assert.equal(body.varianceCents, 0);
  assert.ok(body.generatedAt);
  assert.deepEqual(
    (body.range as { from: string; to: string }),
    { from, to },
  );
  assert.ok(Array.isArray(body.providers));
  const providers = body.providers as Array<{ provider: string; varianceCents: number }>;
  assert.ok(providers.some((entry) => entry.provider === "mock"));
  for (const provider of providers) assert.equal(provider.varianceCents, 0);

  const rows = ctx.db.all<{ status: string; amount_cents: number; fee_cents: number }>(
    "SELECT status, amount_cents, fee_cents FROM payouts WHERE created_at >= ? AND created_at <= ?",
    [from, to],
  );
  const expectedPaid = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount_cents, 0);
  const expectedPending = rows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const expectedFailed = rows
    .filter((row) => row.status === "failed" || row.status === "rejected")
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const expectedFees = rows
    .filter((row) => row.status === "paid" || row.status === "pending")
    .reduce((sum, row) => sum + row.fee_cents, 0);
  assert.equal(typeof body.counts, "object");
  assert.equal((body.counts as { total: number }).total, rows.length);
  assert.equal(body.paidCents, expectedPaid);
  assert.equal(body.pendingCents, expectedPending);
  assert.equal(body.failedCents, expectedFailed);
  assert.equal(body.feeCents, expectedFees);
  assert.equal(
    body.ledgerPayoutCents,
    expectedPaid + expectedPending,
    "ledger retains exactly the paid + pending gross amounts",
  );

  const refunded = ctx.db.get<{ total: number }>(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM payouts p JOIN ledger_entries l ON l.ref_type = 'payout' AND l.ref_id = p.id
     WHERE l.type = 'payout_refund' AND p.created_at >= ? AND p.created_at <= ?`,
    [from, to],
  );
  assert.equal((body.counts as { refunded: number }).refunded, refunded?.total);
  assert.ok((body.withdrawableOutstandingCents as number) <= (body.creditOutstandingCents as number));

  const regularUser = await login(ctx.request);
  const forbidden = await ctx.request
    .get(`${PREFIX}/admin/reconciliation`)
    .set(regularUser.auth);
  assert.equal(forbidden.status, 403);
});
