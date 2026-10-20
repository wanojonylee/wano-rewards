/**
 * WANO Rewards — API acceptance script (logical checks).
 * Usage: node verify-api.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:8787/api/v1';

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const uniq = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function main() {
  const health = await call('GET', '/health');
  check('health', health.status === 200 && health.json.ok === true, JSON.stringify(health.json));

  const otp = await call('POST', '/auth/request-otp', { body: { identifier: '+5511999990000' } });
  check('request-otp returns devCode', otp.status === 200 && otp.json.devCode === '123456');
  const verify = await call('POST', '/auth/verify', {
    body: { identifier: '+5511999990000', code: otp.json.devCode, locale: 'pt-BR' },
  });
  check('verify returns JWT', verify.status === 200 && typeof verify.json.accessToken === 'string', verify.json?.user?.name);
  const token = verify.json.accessToken;

  const me0 = await call('GET', '/me', { token });
  check('GET /me', me0.status === 200 && !!me0.json.wallet, `points=${me0.json.wallet?.points}`);
  const startPoints = me0.json.wallet.points;

  const home = await call('GET', '/home', { token });
  check('GET /home', home.status === 200 && !!home.json.wallet && Array.isArray(home.json.campaigns));
  check('home.weeklyGoal present', !!home.json.weeklyGoal, JSON.stringify(home.json.weeklyGoal));

  const impact = await call('GET', '/impact', { token });
  check(
    'GET /impact',
    impact.status === 200 && Array.isArray(impact.json.months) && Array.isArray(impact.json.materials) && !!impact.json.totals,
    `months=${impact.json?.months?.length}`,
  );

  const config = await call('GET', '/config');
  check('GET /config', config.status === 200 && config.json.currency === 'BRL');

  const packs = await call('GET', '/payments/packs', { token });
  check('GET /payments/packs', packs.status === 200 && packs.json.items.length === 3);

  const rewards = await call('GET', '/rewards?limit=5', { token });
  check('GET /rewards', rewards.status === 200 && rewards.json.items.length > 0, `count=${rewards.json?.items?.length}`);

  const campaign = await call('GET', '/campaigns/cmp_aurora', { token });
  check('GET /campaigns/:id', campaign.status === 200 && !!campaign.json.campaign, `rows=${campaign.json?.leaderboard?.length}`);

  const board = await call('GET', '/leaderboard?scope=condo', { token });
  check('GET /leaderboard', board.status === 200 && board.json.rows.length > 0, `me=${board.json?.me?.position}`);

  const notifications = await call('GET', '/notifications', { token });
  check('GET /notifications', notifications.status === 200 && Array.isArray(notifications.json.items), `unread=${notifications.json?.unread}`);

  const referral = await call('GET', '/referral', { token });
  check('GET /referral', referral.status === 200 && !!referral.json.code, referral.json?.code);

  const machines = await call('GET', '/machines', { token });
  check('GET /machines', machines.status === 200 && machines.json.items.length > 0);

  const start = await call('POST', '/sessions/start', { token, body: { machineCode: 'RVM-SP-001', source: 'qr' } });
  check('POST /sessions/start', start.status === 201 && !!start.json.session?.id);
  const sessionId = start.json?.session?.id;
  let simulated = 0;
  for (let i = 0; i < 3; i += 1) {
    const dep = await call('POST', `/sessions/${sessionId}/simulate-deposit`, { token, body: {} });
    if (dep.status < 400) simulated += 1;
  }
  check('simulate deposits', simulated >= 1, `${simulated}/3 accepted`);
  const complete = await call('POST', `/sessions/${sessionId}/complete`, { token });
  check('complete session credits ledger', complete.status === 200 && !!complete.json.session?.receipt, `items=${complete.json?.session?.totals?.items}`);

  const meBeforeRedeem = await call('GET', '/me', { token });
  const pointsBeforeRedeem = meBeforeRedeem.json.wallet.points;

  const reward = rewards.json.items.find((r) => r.category === 'voucher') ?? rewards.json.items[0];
  const key = `redeem-${uniq()}`;
  const redeem = await call('POST', `/rewards/${reward.id}/redeem`, {
    token,
    headers: { 'Idempotency-Key': key },
    body: { quantity: 1 },
  });
  check('redeem reward', redeem.status === 201 && !!redeem.json.redemption?.code, `code=${redeem.json?.redemption?.code}`);
  const replay = await call('POST', `/rewards/${reward.id}/redeem`, {
    token,
    headers: { 'Idempotency-Key': key },
    body: { quantity: 1 },
  });
  check('redeem idempotent replay', replay.status === 201 && replay.json.redemption?.code === redeem.json.redemption?.code && replay.json.replayed === true);

  const meAfterRedeem = await call('GET', '/me', { token });
  check('redeem debits points once', meAfterRedeem.json.wallet.points === pointsBeforeRedeem - reward.pointsCost, `${pointsBeforeRedeem} -> ${meAfterRedeem.json.wallet.points}`);

  const checkout = await call('POST', '/payments/checkout', {
    token,
    headers: { 'Idempotency-Key': `co-${uniq()}` },
    body: { packId: 'pack-20', successUrl: 'recio://wallet', cancelUrl: 'recio://wallet?cancel=1' },
  });
  check('checkout creates mock payment', checkout.status === 201 && checkout.json.payment?.provider === 'mock', checkout.json?.payment?.provider);
  const payId = checkout.json?.payment?.id;
  const completePay = await call('POST', `/payments/${payId}/mock-complete`, { token, body: {} });
  check('mock-complete credits wallet', completePay.status === 200 && completePay.json.payment?.status === 'paid', `credit=${completePay.json?.wallet?.creditCents}`);
  await call('POST', `/payments/${payId}/mock-complete`, { token, body: {} });
  const meAfterPay = await call('GET', '/me', { token });
  check('mock-complete idempotent (credit once)', meAfterPay.json.wallet.creditCents === completePay.json.wallet.creditCents);

  const payout = await call('POST', '/payouts', {
    token,
    headers: { 'Idempotency-Key': `po-${uniq()}` },
    body: { amountCents: 2000, pixKey: 'marina@example.com', pixKeyType: 'email' },
  });
  check('payout accepted when withdrawable (fee applied)', payout.status === 201 && payout.json.payout?.status === 'pending' && payout.json.payout?.feeCents === 150, `net=${payout.json?.payout?.netCents}`);

  const failedPayout = await call('POST', '/payouts', { token, body: { amountCents: 100, pixKey: 'marina@example.com', pixKeyType: 'email' } });
  check('payout below minimum rejected', failedPayout.status >= 400);

  const adminOtp = await call('POST', '/auth/request-otp', { body: { identifier: '+5511988880000' } });
  const adminVerify = await call('POST', '/auth/verify', {
    body: { identifier: '+5511988880000', code: adminOtp.json.devCode ?? '123456', locale: 'pt-BR' },
  });
  const adminToken = adminVerify.json?.accessToken;
  check('admin login', typeof adminToken === 'string');
  const adminPayouts = await call('GET', '/admin/payouts?status=all', { token: adminToken });
  check('GET /admin/payouts', adminPayouts.status === 200 && Array.isArray(adminPayouts.json.items));
  const reconciliation = await call('GET', '/admin/reconciliation', { token: adminToken });
  check(
    'GET /admin/reconciliation balanced',
    reconciliation.status === 200 && reconciliation.json.balanced === true && reconciliation.json.varianceCents === 0,
    `variance=${reconciliation.json?.varianceCents}`,
  );

  const exported = await call('GET', '/me/export', { token });
  check('LGPD export creates job', exported.status === 202 || exported.status === 200, `status=${exported.status}`);

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
  if (failures.length) {
    console.log('FAILURES:', failures.map((f) => f.name).join(', '));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
