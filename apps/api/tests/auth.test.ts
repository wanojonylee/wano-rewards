import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_PATH = `./data/test-auth-${randomUUID()}.db`;
process.env.AUTH_DEV_MODE = "true";
process.env.DEMO_MODE = "true";
process.env.AUTO_SEED = "false";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";

const { createTestContext, seedFixtures, PREFIX } = await import("./helpers.ts");
const ctx = await createTestContext();
seedFixtures(ctx.db);

after(async () => {
  await ctx.close();
});

const phone = "+5511900000001";

test("request-otp returns devCode in dev mode and stores a hashed code", async () => {
  const res = await ctx.request.post(`${PREFIX}/auth/request-otp`).send({ identifier: phone, channel: "sms" });
  assert.equal(res.status, 200);
  assert.equal(res.body.sent, true);
  assert.equal(res.body.devCode, "123456");
  assert.equal(res.body.expiresIn, 300);

  const row = ctx.db.get<{ code_hash: string }>(
    "SELECT code_hash FROM otp_codes WHERE identifier = ? ORDER BY created_at DESC LIMIT 1",
    [phone],
  );
  assert.ok(row);
  assert.notEqual(row?.code_hash, "123456", "OTP must never be stored in plain text");
});

test("verify creates the user, wallet and returns tokens", async () => {
  const res = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: phone, code: "123456", locale: "pt-BR" });
  assert.equal(res.status, 200);
  assert.equal(res.body.isNewUser, true);
  assert.equal(res.body.user.phone, phone);
  assert.ok(res.body.accessToken.split(".").length === 3);
  assert.ok(res.body.refreshToken.length >= 40);

  const wallet = ctx.db.get<{ points: number }>("SELECT points FROM wallet WHERE user_id = ?", [
    res.body.user.id,
  ]);
  assert.equal(wallet?.points, 0);
});

test("GET /me requires a valid bearer token", async () => {
  const noToken = await ctx.request.get(`${PREFIX}/me`);
  assert.equal(noToken.status, 401);
  assert.equal(noToken.body.error.code, "UNAUTHENTICATED");
  assert.ok(noToken.body.requestId);

  const badToken = await ctx.request.get(`${PREFIX}/me`).set("Authorization", "Bearer not-a-jwt");
  assert.equal(badToken.status, 401);

  const login = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: phone, code: "123456" });
  // Codes are single-use; request a fresh one for a real session.
  await ctx.request.post(`${PREFIX}/auth/request-otp`).send({ identifier: phone });
  const verified = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: phone, code: "123456" });
  assert.equal(verified.status, 200);
  const me = await ctx.request
    .get(`${PREFIX}/me`)
    .set("Authorization", `Bearer ${verified.body.accessToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.phone, phone);
  assert.ok(me.body.wallet);
  assert.ok(me.body.tier.code);
  void login;
});

test("wrong code is rejected and attempts are capped", async () => {
  const target = "+5511900000002";
  await ctx.request.post(`${PREFIX}/auth/request-otp`).send({ identifier: target });

  const wrong = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: target, code: "000000" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, "INVALID_CODE");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await ctx.request.post(`${PREFIX}/auth/verify`).send({ identifier: target, code: "000000" });
  }
  const capped = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: target, code: "000000" });
  assert.equal(capped.status, 400);
  assert.equal(capped.body.error.code, "TOO_MANY_ATTEMPTS");

  const evenCorrect = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: target, code: "123456" });
  assert.equal(evenCorrect.body.error.code, "TOO_MANY_ATTEMPTS");
});

test("expired OTP returns CODE_EXPIRED", async () => {
  const target = "+5511900000003";
  await ctx.request.post(`${PREFIX}/auth/request-otp`).send({ identifier: target });
  ctx.db.run("UPDATE otp_codes SET expires_at = ? WHERE identifier = ?", [
    new Date(Date.now() - 60_000).toISOString(),
    target,
  ]);
  const res = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: target, code: "123456" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "CODE_EXPIRED");
});

test("refresh tokens rotate and reuse revokes the family", async () => {
  const target = "+5511900000004";
  await ctx.request.post(`${PREFIX}/auth/request-otp`).send({ identifier: target });
  const login = await ctx.request
    .post(`${PREFIX}/auth/verify`)
    .send({ identifier: target, code: "123456" });

  const refreshed = await ctx.request
    .post(`${PREFIX}/auth/refresh`)
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);

  const reuse = await ctx.request
    .post(`${PREFIX}/auth/refresh`)
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(reuse.status, 401);

  const afterReuse = await ctx.request
    .post(`${PREFIX}/auth/refresh`)
    .send({ refreshToken: refreshed.body.refreshToken });
  assert.equal(afterReuse.status, 401, "family must be revoked on reuse");

  const logout = await ctx.request.post(`${PREFIX}/auth/logout`).send({});
  assert.equal(logout.status, 204);
});
