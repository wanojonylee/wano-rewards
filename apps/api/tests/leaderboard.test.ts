import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-leaderboard-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX, login, setUserCondo } = await import("./helpers.ts");
const ctx = await createTestContext();
const fixtures = seedFixtures(ctx.db);

const now = new Date();
const iso = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
ctx.db.run(
  `INSERT INTO campaigns (id, slug, title, brand, target_brand, subtitle, material, multiplier,
     bonus_points, starts_at, ends_at, image_key, accent, target_value, baseline_value, target_unit,
     scope, condo_id, active, created_at, updated_at)
   VALUES ('cmp_board', 'coleta-teste', 'Coleta Teste', 'RecIO', NULL, 'Campanha de teste', 'PET',
     2, 0, ?, ?, 'bottle', '#10B981', 100, 42, 'items', 'condo', ?, 1, ?, ?)`,
  [iso(-1), iso(9), fixtures.condoId, iso(-2), iso(-2)],
);

const DEPOSIT_MATERIALS = ["PET", "ALUMINUM", "GLASS"] as const;

async function depositAs(identifier: string, count: number): Promise<{ auth: { Authorization: string }; id: string }> {
  const user = await login(ctx.request, identifier);
  setUserCondo(ctx.db, user.user.id, fixtures.condoId, fixtures.buildingId);
  const started = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.onlineMachineCode });
  for (let i = 0; i < count; i += 1) {
    await ctx.request
      .post(`${PREFIX}/sessions/${started.body.session.id}/simulate-deposit`)
      .set(user.auth)
      .send({ material: DEPOSIT_MATERIALS[i % DEPOSIT_MATERIALS.length] });
  }
  await ctx.request.post(`${PREFIX}/sessions/${started.body.session.id}/complete`).set(user.auth).send({});
  return { auth: user.auth, id: user.user.id };
}

after(async () => {
  await ctx.close();
});

test("condo leaderboard is derived from deposits and marks me", async () => {
  const alice = await depositAs("+5511910000001", 3);
  const bob = await depositAs("+5511910000002", 1);
  void bob;

  const board = await ctx.request.get(`${PREFIX}/leaderboard?scope=condo`).set(alice.auth);
  assert.equal(board.status, 200);
  assert.equal(board.body.scope, "condo");
  assert.ok(board.body.period.from && board.body.period.to);
  assert.ok(board.body.rows.length >= 2);
  assert.equal(board.body.rows[0].position, 1);
  assert.ok(board.body.rows[0].value >= board.body.rows[1].value);
  assert.equal(board.body.rows[0].unit, "pts");
  assert.equal(board.body.rows[0].isMe, true);
  assert.equal(board.body.me.position, 1);
  assert.equal(board.body.me.total, board.body.rows.length >= 2 ? board.body.me.total : 0);
  assert.ok(board.body.me.displayName.length > 0);

  const building = await ctx.request.get(`${PREFIX}/leaderboard?scope=building`).set(alice.auth);
  assert.equal(building.status, 200);
  assert.ok(building.body.rows.length >= 2);

  const city = await ctx.request.get(`${PREFIX}/leaderboard?scope=city`).set(alice.auth);
  assert.equal(city.status, 200);
  assert.ok(city.body.rows.length >= 2);
});

test("campaign list, detail and campaign leaderboard", async () => {
  const user = await login(ctx.request, "+5511910000003");
  setUserCondo(ctx.db, user.user.id, fixtures.condoId, fixtures.buildingId);

  const campaigns = await ctx.request.get(`${PREFIX}/campaigns`).set(user.auth);
  assert.equal(campaigns.status, 200);
  assert.equal(campaigns.body.items.length, 1);
  const campaign = campaigns.body.items[0];
  assert.equal(campaign.id, "cmp_board");
  assert.equal(campaign.multiplier, 2);
  assert.equal(campaign.progress.target, 100);
  assert.ok(campaign.progress.current >= 42);

  const detail = await ctx.request.get(`${PREFIX}/campaigns/cmp_board`).set(user.auth);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.campaign.id, "cmp_board");
  assert.ok(Array.isArray(detail.body.leaderboard));
  assert.ok(detail.body.leaderboard.length >= 1);
  assert.equal(detail.body.leaderboard[0].position, 1);
  assert.ok("userPosition" in detail.body);

  const bySlug = await ctx.request.get(`${PREFIX}/campaigns/coleta-teste`).set(user.auth);
  assert.equal(bySlug.status, 200);

  const campaignBoard = await ctx.request
    .get(`${PREFIX}/leaderboard?scope=condo&campaignId=cmp_board`)
    .set(user.auth);
  assert.equal(campaignBoard.status, 200);
  assert.ok(campaignBoard.body.rows.length >= 1);
  assert.equal(campaignBoard.body.period.label, "Coleta Teste");

  const missing = await ctx.request.get(`${PREFIX}/leaderboard?campaignId=cmp_missing`).set(user.auth);
  assert.equal(missing.status, 404);
});
