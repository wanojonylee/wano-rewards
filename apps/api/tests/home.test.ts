import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-home-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX, login, setUserCondo, fundWallet } = await import("./helpers.ts");
const ctx = await createTestContext();
const fixtures = seedFixtures(ctx.db);

const now = new Date();
const iso = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
ctx.db.run(
  `INSERT INTO campaigns (id, slug, title, brand, target_brand, subtitle, material, multiplier,
     bonus_points, starts_at, ends_at, image_key, accent, target_value, baseline_value, target_unit,
     scope, condo_id, active, created_at, updated_at)
   VALUES ('cmp_test', 'desafio-teste', 'Desafio Teste', 'RecIO', NULL, 'Campanha de teste', 'PET',
     1.5, 20, ?, ?, 'bottle', '#10B981', 200, 100, 'kg', 'condo', ?, 1, ?, ?)`,
  [iso(-1), iso(10), fixtures.condoId, iso(-2), iso(-2)],
);

after(async () => {
  await ctx.close();
});

test("GET /me returns user, wallet, tier, stats and rank", async () => {
  const user = await login(ctx.request);
  setUserCondo(ctx.db, user.user.id, fixtures.condoId, fixtures.buildingId);
  await fundWallet(user.user.id, { points: 600, creditCents: 1000, withdrawableCents: 400 });

  const me = await ctx.request.get(`${PREFIX}/me`).set(user.auth);
  assert.equal(me.status, 200);
  assert.deepEqual(Object.keys(me.body).sort(), ["rank", "stats", "tier", "user", "wallet"]);
  assert.equal(me.body.user.id, user.user.id);
  assert.equal(me.body.user.consent.marketingOptIn, false);
  assert.equal(me.body.wallet.points, 600);
  assert.equal(me.body.wallet.creditCents, 1000);
  assert.equal(me.body.wallet.withdrawableCents, 400);
  assert.equal(me.body.tier.code, "sprout");
  assert.equal(me.body.tier.nextTier.code, "forest");
  assert.ok(me.body.tier.perks.length > 0);
  assert.equal(me.body.rank.condo.position, 1);
  assert.equal(me.body.rank.condo.total, 1);
  assert.equal(me.body.stats.itemsTotal, 0);
});

test("GET /home aggregates wallet, campaigns, recent activity and weekly goal", async () => {
  const user = await login(ctx.request);
  setUserCondo(ctx.db, user.user.id, fixtures.condoId, fixtures.buildingId);
  await fundWallet(user.user.id, { points: 600, creditCents: 200, withdrawableCents: 200 });

  const started = await ctx.request
    .post(`${PREFIX}/sessions/start`)
    .set(user.auth)
    .send({ machineCode: fixtures.onlineMachineCode });
  for (const material of ["PET", "ALUMINUM"]) {
    await ctx.request
      .post(`${PREFIX}/sessions/${started.body.session.id}/simulate-deposit`)
      .set(user.auth)
      .send({ material });
  }
  await ctx.request.post(`${PREFIX}/sessions/${started.body.session.id}/complete`).set(user.auth).send({});

  const home = await ctx.request.get(`${PREFIX}/home`).set(user.auth);
  assert.equal(home.status, 200);
  assert.ok(home.body.wallet.points > 600);
  assert.equal(home.body.tier.code, "sprout");
  assert.equal(home.body.stats.itemsTotal, 2);
  assert.equal(home.body.stats.sessionsTotal, 1);
  assert.ok(home.body.stats.kgTotal > 0);
  assert.ok(home.body.stats.co2SavedKg > 0);
  assert.ok(home.body.recent.length >= 1);
  assert.ok(home.body.recent.some((entry: { type: string }) => entry.type === "deposit"));
  assert.equal(home.body.campaigns.length, 1);
  assert.equal(home.body.campaigns[0].title, "Desafio Teste");
  assert.equal(home.body.campaigns[0].multiplier, 1.5);
  assert.equal(home.body.campaigns[0].joined, true);
  assert.equal(home.body.campaigns[0].progress.unit, "kg");
  assert.ok(home.body.campaigns[0].progress.current >= 100);
  assert.equal(home.body.nearbyMachine.code, fixtures.onlineMachineCode);
  assert.equal(home.body.weeklyGoal.targetItems, 20);
  assert.equal(home.body.weeklyGoal.currentItems, 2);
  assert.equal(home.body.weeklyGoal.percent, 10);
  assert.equal(home.body.greetingName.length > 0, true);
  assert.equal(home.body.rank.condo.total >= 1, true);
});

test("GET /config exposes the authoritative economy", async () => {
  const config = await ctx.request.get(`${PREFIX}/config`);
  assert.equal(config.status, 200);
  assert.equal(config.body.currency, "BRL");
  assert.equal(config.body.locale, "pt-BR");
  assert.deepEqual(config.body.locales, ["pt-BR", "en"]);
  assert.equal(config.body.materials.length, 6);
  assert.equal(config.body.pointsPerKg.PET, 357);
  assert.equal(config.body.pointsPerKg.ALUMINUM, 1000);
  assert.ok(config.body.legal.privacyUrl.startsWith("https://"));
  assert.ok(config.body.supportEmail.includes("@"));
  assert.equal(config.body.version, "1.0.0");
});

test("machines list, distance sort and detail impact", async () => {
  const list = await ctx.request.get(`${PREFIX}/machines?lat=-23.56&lng=-46.69`);
  assert.equal(list.status, 200);
  assert.ok(list.body.items.length >= 3);
  assert.ok(list.body.items[0].distanceMeters <= list.body.items[1].distanceMeters);
  assert.ok(list.body.items[0].materials.includes("PET"));
  assert.ok(["online", "full", "maintenance"].includes(list.body.items[0].status));

  const detail = await ctx.request.get(`${PREFIX}/machines/${fixtures.onlineMachineCode}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.machine.code, fixtures.onlineMachineCode);
  assert.ok(detail.body.recentImpact.periodDays === 30);
});
