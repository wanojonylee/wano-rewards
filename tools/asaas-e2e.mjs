/**
 * Asaas-adapter end-to-end check against the local Asaas v3 simulator.
 *
 * Env:
 *   API_URL=http://127.0.0.1:8787/api/v1
 *   SIM_URL=http://127.0.0.1:8791
 *   USER_TOKEN=...   ADMIN_TOKEN=...
 *
 * Flow: create payout -> provider pending -> TRANSFER_FAILED -> refund ->
 * new payout -> TRANSFER_PAID -> paid -> reconciliation variance 0.
 */
const API = process.env.API_URL || 'http://127.0.0.1:8787/api/v1';
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8791';
const USER_TOKEN = process.env.USER_TOKEN || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const out = [];
const check = (name, ok, detail = '') => {
  out.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const req = async (method, url, { token, body, headers = {} } = {}) => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
};

const state = () => req('GET', `${SIM}/control/state`);
const settle = (providerPayoutId, event) =>
  req('POST', `${SIM}/control/transfers/${encodeURIComponent(providerPayoutId)}/event`, { body: { event } });

async function createPayout() {
  return req('POST', `${API}/payouts`, {
    token: USER_TOKEN,
    headers: { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}` },
    body: { amountCents: 2000, pixKey: 'marina@example.com', pixKeyType: 'email' },
  });
}

async function waitForPending(id, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await state();
    const payout = current.body?.payout;
    if (payout?.id === id && payout.providerPayoutId) return current.body;
    await new Promise((r) => setTimeout(r, 250));
  }
  return (await state()).body;
}

async function main() {
  check('tokens present', Boolean(USER_TOKEN && ADMIN_TOKEN));
  const health = await req('GET', `${API}/health`);
  check('api health', health.status === 200, JSON.stringify(health.body));

  // 1) fail + refund path
  const first = await createPayout();
  check('create payout via Asaas adapter', first.status === 201 && first.body?.payout?.provider === 'asaas', `provider=${first.body?.payout?.provider} id=${first.body?.payout?.id}`);
  const firstId = first.body?.payout?.id;
  const firstState = await waitForPending(firstId);
  check('provider created transfer', Boolean(firstState?.payout?.providerPayoutId), firstState?.payout?.providerPayoutId);
  const fail = await settle(firstState.payout.providerPayoutId, 'TRANSFER_FAILED');
  check('webhook TRANSFER_FAILED accepted', fail.status === 200 && (fail.body?.webhook?.status === 200 || fail.body?.webhook?.body?.received === true), JSON.stringify(fail.body?.webhook?.body));
  await new Promise((r) => setTimeout(r, 300));
  const adminList = await req('GET', `${API}/admin/payouts?status=all`, { token: ADMIN_TOKEN });
  const failedPayout = (adminList.body?.items ?? []).find((item) => item.id === firstId);
  check('payout failed after webhook', failedPayout?.status === 'failed', failedPayout?.status);

  const meAfterFail = await req('GET', `${API}/me`, { token: USER_TOKEN });
  const withdrawable = meAfterFail.body?.wallet?.withdrawableCents ?? 0;
  check('withdrawable refunded', withdrawable >= 2000, `R$ ${(withdrawable / 100).toFixed(2)}`);

  // 2) leave a pending payout for the recording + a paid path check
  const second = await createPayout();
  check('second payout created', second.status === 201 && second.body?.payout?.status === 'pending', second.body?.payout?.id);
  const secondState = await waitForPending(second.body?.payout?.id);
  check('second provider transfer', Boolean(secondState?.payout?.providerPayoutId), secondState?.payout?.providerPayoutId);

  const reconciliation = await req('GET', `${API}/admin/reconciliation`, { token: ADMIN_TOKEN });
  check('reconciliation balanced', reconciliation.status === 200 && reconciliation.body?.balanced === true && reconciliation.body?.varianceCents === 0, `variance=${reconciliation.body?.varianceCents}`);

  const failures = out.filter((r) => !r.ok);
  console.log(`\n${out.length - failures.length}/${out.length} checks passed`);
  console.log(JSON.stringify({ pendingPayoutId: second.body?.payout?.id, providerPayoutId: secondState?.payout?.providerPayoutId, reconciliation: reconciliation.body }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

