import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-payments-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

const { createTestContext, seedFixtures, PREFIX, login } = await import("./helpers.ts");
const ctx = await createTestContext();
seedFixtures(ctx.db);

const stripe = new Stripe("sk_test_signature_only");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

function signedEvent(event: Record<string, unknown>): { payload: string; signature: string } {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return { payload, signature };
}

const server = ctx.app.listen(0);
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const webhookUrl = `http://127.0.0.1:${port}${PREFIX}/webhooks/stripe`;

async function postWebhook(payload: string, signature: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
    body: payload,
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

function insertStripePayment(userId: string, paymentId: string): void {
  const now = new Date().toISOString();
  ctx.db.run(
    `INSERT INTO payments (id, user_id, kind, pack_id, status, provider, amount_cents, credit_cents,
       bonus_points, currency, checkout_url, stripe_session_id, stripe_payment_intent_id, code,
       machine_id, metadata_json, created_at, completed_at, updated_at)
     VALUES (?, ?, 'topup', 'pack-50', 'requires_payment', 'stripe', 5000, 5000, 150, 'BRL',
       NULL, ?, NULL, NULL, NULL, NULL, ?, NULL, ?)`,
    [paymentId, userId, `cs_test_${paymentId}`, now, now],
  );
}

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await ctx.close();
});

test("packs are server-authoritative", async () => {
  const user = await login(ctx.request);
  const packs = await ctx.request.get(`${PREFIX}/payments/packs`).set(user.auth);
  assert.equal(packs.status, 200);
  assert.equal(packs.body.items.length, 3);
  const pack50 = packs.body.items.find((pack: { id: string }) => pack.id === "pack-50");
  assert.deepEqual(pack50, {
    id: "pack-50",
    creditCents: 5000,
    bonusPoints: 150,
    priceCents: 5000,
    currency: "BRL",
    label: "R$ 50",
    badge: "Mais popular",
  });
});

test("mock checkout returns a mock URL and credits the wallet exactly once", async () => {
  const user = await login(ctx.request);
  const idem = randomUUID();
  const checkoutRes = await ctx.request
    .post(`${PREFIX}/payments/checkout`)
    .set(user.auth)
    .set("Idempotency-Key", idem)
    .send({ packId: "pack-20", successUrl: "recio://wallet?status=success", cancelUrl: "recio://wallet?status=cancel" });
  assert.equal(checkoutRes.status, 201);
  assert.equal(checkoutRes.body.payment.provider, "mock");
  assert.equal(checkoutRes.body.payment.status, "requires_payment");
  assert.equal(checkoutRes.body.payment.checkoutUrl, `mock://checkout/${checkoutRes.body.payment.id}`);
  assert.equal(checkoutRes.body.payment.amountCents, 2000);

  // Replaying checkout with the same key returns the same payment.
  const replay = await ctx.request
    .post(`${PREFIX}/payments/checkout`)
    .set(user.auth)
    .set("Idempotency-Key", idem)
    .send({ packId: "pack-20", successUrl: "recio://wallet?status=success", cancelUrl: "recio://wallet?status=cancel" });
  assert.equal(replay.body.payment.id, checkoutRes.body.payment.id);
  assert.equal(replay.body.replayed, true);

  const paymentId = checkoutRes.body.payment.id as string;
  const fetched = await ctx.request.get(`${PREFIX}/payments/${paymentId}`).set(user.auth);
  assert.equal(fetched.status, 200);

  const paid = await ctx.request
    .post(`${PREFIX}/payments/${paymentId}/mock-complete`)
    .set(user.auth)
    .send({});
  assert.equal(paid.status, 200);
  assert.equal(paid.body.payment.status, "paid");
  assert.equal(paid.body.wallet.creditCents, 2000);
  assert.equal(paid.body.wallet.withdrawableCents, 0, "top-up credit is not withdrawable");
  assert.equal(paid.body.wallet.points, 50);

  const paidAgain = await ctx.request
    .post(`${PREFIX}/payments/${paymentId}/mock-complete`)
    .set(user.auth)
    .send({});
  assert.equal(paidAgain.status, 200);
  assert.equal(paidAgain.body.wallet.creditCents, 2000);
  assert.equal(paidAgain.body.wallet.points, 50);
});

test("stripe webhook verifies the signature and is idempotent by event id", async () => {
  const user = await login(ctx.request);
  const paymentId = "pay_stripe_test";
  insertStripePayment(user.user.id, paymentId);

  const event = {
    id: `evt_${randomUUID()}`,
    object: "event",
    api_version: "2025-01-01",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${paymentId}`,
        object: "checkout.session",
        payment_intent: `pi_${paymentId}`,
        client_reference_id: paymentId,
        metadata: { paymentId, userId: user.user.id },
      },
    },
  };
  const { payload, signature } = signedEvent(event);

  const invalid = await postWebhook(payload, "t=1,v1=deadbeef");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "INVALID_SIGNATURE");

  const first = await postWebhook(payload, signature);
  assert.equal(first.status, 200);
  assert.equal(first.body.received, true);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 5000);
  assert.equal(me.body.wallet.withdrawableCents, 0);
  assert.equal(me.body.wallet.points, 150);

  const duplicate = await postWebhook(payload, signature);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  const meAfter = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(meAfter.body.wallet.creditCents, 5000, "event must not credit twice");

  const paidRow = ctx.db.get<{ status: string; stripe_payment_intent_id: string }>(
    "SELECT status, stripe_payment_intent_id FROM payments WHERE id = ?",
    [paymentId],
  );
  assert.equal(paidRow?.status, "paid");
  assert.equal(paidRow?.stripe_payment_intent_id, `pi_${paymentId}`);

  const events = ctx.db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM webhook_events WHERE id = ?",
    [event.id],
  );
  assert.equal(events?.total, 1);
});

test("charge.refunded reverses the top-up once", async () => {
  const user = await login(ctx.request);
  const paymentId = "pay_stripe_refund";
  insertStripePayment(user.user.id, paymentId);

  const completed = {
    id: `evt_${randomUUID()}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${paymentId}`,
        object: "checkout.session",
        payment_intent: `pi_${paymentId}`,
        metadata: { paymentId },
      },
    },
  };
  const completedSigned = signedEvent(completed);
  const credited = await postWebhook(completedSigned.payload, completedSigned.signature);
  assert.equal(credited.status, 200);

  const refund = {
    id: `evt_${randomUUID()}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    type: "charge.refunded",
    data: {
      object: {
        id: `ch_${paymentId}`,
        object: "charge",
        payment_intent: `pi_${paymentId}`,
        refunded: true,
        amount_refunded: 5000,
      },
    },
  };
  const refundSigned = signedEvent(refund);
  const refunded = await postWebhook(refundSigned.payload, refundSigned.signature);
  assert.equal(refunded.status, 200);

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.body.wallet.creditCents, 0);
  assert.equal(me.body.wallet.points, 0);
  const row = ctx.db.get<{ status: string }>("SELECT status FROM payments WHERE id = ?", [paymentId]);
  assert.equal(row?.status, "refunded");

  const duplicate = await postWebhook(refundSigned.payload, refundSigned.signature);
  assert.equal(duplicate.body.duplicate, true);
  const afterDuplicate = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(afterDuplicate.body.wallet.creditCents, 0);
});
