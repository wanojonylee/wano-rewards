import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-rewards-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX, login, fundWallet, setUserRole } = await import("./helpers.ts");
const ctx = await createTestContext();
const fixtures = seedFixtures(ctx.db);

after(async () => {
  await ctx.close();
});

test("reward catalog paginates and returns related items", async () => {
  const user = await login(ctx.request);
  const page = await ctx.request.get(`${PREFIX}/rewards?limit=1`).set(user.auth);
  assert.equal(page.status, 200);
  assert.equal(page.body.items.length, 1);
  assert.ok(page.body.nextCursor);

  const next = await ctx.request
    .get(`${PREFIX}/rewards?limit=1&cursor=${encodeURIComponent(page.body.nextCursor)}`)
    .set(user.auth);
  assert.equal(next.status, 200);
  assert.notEqual(next.body.items[0].id, page.body.items[0].id);

  const detail = await ctx.request.get(`${PREFIX}/rewards/${fixtures.rewardCheapId}`).set(user.auth);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.reward.id, fixtures.rewardCheapId);
  assert.ok(Array.isArray(detail.body.related));
  assert.equal(detail.body.reward.stockLabel.length > 0, true);
});

test("redeem debits points, decrements stock and creates a signed code", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 1000 });

  const idem = randomUUID();
  const redeemed = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardCheapId}/redeem`)
    .set(user.auth)
    .set("Idempotency-Key", idem)
    .send({ quantity: 1 });
  assert.equal(redeemed.status, 201);
  assert.equal(redeemed.body.wallet.points, 900);
  assert.equal(redeemed.body.redemption.status, "active");
  assert.equal(redeemed.body.redemption.pointsSpent, 100);
  assert.equal(redeemed.body.redemption.code.length, 8);
  assert.equal(redeemed.body.redemption.qrPayload, `recio://redeem/${redeemed.body.redemption.code}`);
  assert.ok(redeemed.body.redemption.reward.title);
  assert.equal(redeemed.body.replayed, undefined);

  const stock = ctx.db.get<{ stock: number }>("SELECT stock FROM rewards WHERE id = ?", [
    fixtures.rewardCheapId,
  ]);
  assert.equal(stock?.stock, 4);

  // Same key + same body -> replay, no double debit.
  const replay = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardCheapId}/redeem`)
    .set(user.auth)
    .set("Idempotency-Key", idem)
    .send({ quantity: 1 });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.redemption.id, redeemed.body.redemption.id);
  assert.equal(replay.body.wallet.points, 900);

  // Same key + different body -> conflict.
  const conflict = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardCheapId}/redeem`)
    .set(user.auth)
    .set("Idempotency-Key", idem)
    .send({ quantity: 2 });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
});

test("redeem enforces balance, stock and delivery rules", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 900 });

  const expensive = await ctx.request
    .post(`${PREFIX}/rewards/rwd_test_expensive/redeem`)
    .set(user.auth)
    .send({ quantity: 1 });
  assert.equal(expensive.status, 409);
  assert.equal(expensive.body.error.code, "INSUFFICIENT_POINTS");

  const outOfStock = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardOutOfStockId}/redeem`)
    .set(user.auth)
    .send({ quantity: 1 });
  assert.equal(outOfStock.status, 409);
  assert.equal(outOfStock.body.error.code, "OUT_OF_STOCK");

  const noDelivery = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardPhysicalId}/redeem`)
    .set(user.auth)
    .send({ quantity: 1 });
  assert.equal(noDelivery.status, 400);
  assert.equal(noDelivery.body.error.code, "DELIVERY_REQUIRED");

  const withDelivery = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardPhysicalId}/redeem`)
    .set(user.auth)
    .send({
      quantity: 1,
      delivery: {
        name: "Marina Costa",
        line1: "Rua dos Pinheiros, 1420",
        city: "São Paulo",
        state: "SP",
        postalCode: "05422-001",
      },
    });
  assert.equal(withDelivery.status, 201);
  assert.equal(withDelivery.body.wallet.points, 700);
  assert.equal(withDelivery.body.redemption.delivery.city, "São Paulo");
});

test("redemptions list/detail and partner mark-used", async () => {
  const user = await login(ctx.request);
  await fundWallet(user.user.id, { points: 500 });
  const redeemed = await ctx.request
    .post(`${PREFIX}/rewards/${fixtures.rewardCheapId}/redeem`)
    .set(user.auth)
    .send({ quantity: 1 });
  const redemptionId = redeemed.body.redemption.id as string;

  const list = await ctx.request.get(`${PREFIX}/redemptions?status=active`).set(user.auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.items.length >= 1);
  assert.ok("nextCursor" in list.body);

  const detail = await ctx.request.get(`${PREFIX}/redemptions/${redemptionId}`).set(user.auth);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.redemption.id, redemptionId);

  const forbidden = await ctx.request
    .post(`${PREFIX}/redemptions/${redemptionId}/mark-used`)
    .set(user.auth)
    .send({});
  assert.equal(forbidden.status, 403);

  const partner = await login(ctx.request);
  setUserRole(ctx.db, partner.user.id, "partner");
  const used = await ctx.request
    .post(`${PREFIX}/redemptions/${redemptionId}/mark-used`)
    .set(partner.auth)
    .send({});
  assert.equal(used.status, 200);
  assert.equal(used.body.redemption.status, "used");
  assert.ok(used.body.redemption.usedAt);

  const reuse = await ctx.request
    .post(`${PREFIX}/redemptions/${redemptionId}/mark-used`)
    .set(partner.auth)
    .send({});
  assert.equal(reuse.status, 200);
  assert.equal(reuse.body.redemption.status, "used");
});
