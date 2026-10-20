/**
 * Local Asaas sandbox simulator (API v3 compatible subset) used to exercise the
 * real AsaasPixProvider + payout webhook lifecycle without external credentials.
 *
 * Endpoints:
 *   POST /v3/transfers              (access_token)  -> create transfer (PENDING)
 *   GET  /v3/transfers/:id          (access_token)  -> status
 *   GET  /control/state                             -> transfers, events, payout view
 *   POST /control/transfers/:id/event {event}       -> simulate TRANSFER_PAID / TRANSFER_FAILED
 *   POST /control/create-payout                     -> create a R$20 payout via the API (user token)
 *   GET  /                                          -> demo control room UI
 *
 * Env:
 *   PORT=8791
 *   API_URL=http://127.0.0.1:8787/api/v1
 *   ASAAS_API_KEY=sandbox_demo_key
 *   ASAAS_WEBHOOK_TOKEN=wano_pix_demo_token
 *   ADMIN_TOKEN=...   (admin JWT, for the payout panel)
 *   USER_TOKEN=...    (user JWT, for "new payout" button)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8791);
const API_URL = process.env.API_URL || 'http://127.0.0.1:8787/api/v1';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || 'sandbox_demo_key';
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || 'wano_pix_demo_token';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const USER_TOKEN = process.env.USER_TOKEN || '';

const transfers = new Map();
const events = [];
let nextId = 1;

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

async function api(pathname, options = {}) {
  try {
    const res = await fetch(`${API_URL}${pathname}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } catch (error) {
    return { status: 503, body: { error: error instanceof Error ? error.message : 'api unavailable' } };
  }
}

async function webhookFor(transfer, eventType, failureReason) {
  const id = `evt_${Date.now()}_${nextId}`;
  const payload = {
    id,
    event: eventType,
    transfer: {
      id: transfer.id,
      status: transfer.status,
      externalReference: transfer.externalReference,
      value: transfer.value,
      ...(failureReason ? { failReason: failureReason } : {}),
    },
    ...(failureReason ? { failureReason } : {}),
  };
  const response = await fetch(`${API_URL}/webhooks/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': ASAAS_WEBHOOK_TOKEN },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  events.unshift({ id, at: new Date().toISOString(), event: eventType, transferId: transfer.id, httpStatus: response.status, response: body });
  return { id, status: response.status, body };
}

const page = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Asaas Sandbox · WANO Rewards</title>
<style>
:root{--paper:#f7f4ed;--surface:#fffefb;--ink:#14160f;--muted:#73776b;--line:#e4dfd3;--forest:#0c3b2a;--lime:#d8ee8b;--danger:#b3261e;--ok:#1f7a5c;--amber:#a9650f}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Manrope,system-ui,-apple-system,sans-serif;font-size:15px}
header{display:flex;align-items:center;justify-content:space-between;padding:22px 36px;border-bottom:1px solid var(--line);background:rgba(247,244,237,.92);position:sticky;top:0;backdrop-filter:blur(8px);z-index:5}
.brand{display:flex;align-items:center;gap:12px}.brand img{height:34px}.tag{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);font-weight:700}
.pill{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;letter-spacing:.6px}
.pill--lime{background:var(--lime);border-color:var(--lime);color:var(--forest)}
main{max-width:1180px;margin:0 auto;padding:30px 36px 60px}
h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:44px;margin:0 0 6px;letter-spacing:-.01em}
.sub{color:var(--muted);margin:0 0 26px;font-size:14px}
.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px}
.card h2{font-size:15px;margin:0 0 4px}.hint{font-size:12px;color:var(--muted);margin:0 0 18px}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.label{font-size:11px;text-transform:uppercase;letter-spacing:1.1px;color:var(--muted);font-weight:700}
.value{font-weight:600}.big{font-family:Georgia,serif;font-size:34px;line-height:1.1}
.badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800;letter-spacing:.4px}
.badge--pending{background:#f6ead6;color:var(--amber)}.badge--paid{background:#e4eee6;color:var(--ok)}.badge--failed{background:#f6e4da;color:var(--danger)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.actions{display:flex;flex-direction:column;gap:10px;margin-top:6px}
button{border:1px solid transparent;border-radius:999px;padding:12px 16px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .12s,opacity .12s}
button:active{transform:scale(.985)}button:disabled{opacity:.45;cursor:not-allowed}
.btn-ok{background:var(--forest);color:#f6f3ea}.btn-fail{background:#f6e4da;color:var(--danger)}.btn-new{background:var(--lime);color:var(--forest)}.btn-ghost{background:transparent;border-color:var(--line);color:var(--ink)}
.log{margin-top:16px;border-top:1px solid var(--line);padding-top:14px;max-height:210px;overflow:auto;font-size:12px;color:var(--muted);line-height:1.6}
.log b{color:var(--ink)}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.kv .label{margin-bottom:4px}.kv .v{font-weight:700;font-size:14px}
.note{font-size:11.5px;color:var(--muted);line-height:1.6;margin-top:14px}
code{background:#f1ede4;border-radius:6px;padding:1px 5px;font-size:11px}
@media(max-width:880px){.grid{grid-template-columns:1fr}main{padding:20px}}
</style></head>
<body>
<header>
  <div class="brand"><img src="/wano-logo.png" alt="WANO"/><span class="tag">WANO Rewards · PIX sandbox</span></div>
  <div style="display:flex;gap:8px;align-items:center">
    <span class="pill" id="provider">asaas · sandbox local</span>
    <span class="pill pill--lime">SIMULADOR</span>
  </div>
</header>
<main>
  <div class="tag">END-TO-END · PIX PAYOUT</div>
  <h1>Saque PIX em tempo real</h1>
  <p class="sub">Backend real (Express + ledger) chamando um provedor com o contrato Asaas v3. Webhooks reais atualizam o saque.</p>
  <div class="grid">
    <div class="card">
      <h2>Saque atual</h2>
      <p class="hint" id="payout-sub">Aguardando solicitação…</p>
      <div class="row"><span class="label">Valor solicitado</span><span class="big" id="amount">—</span></div>
      <div class="row"><span class="label">Taxa</span><span class="value" id="fee">—</span></div>
      <div class="row"><span class="label">Valor líquido ao provedor</span><span class="value" id="net">—</span></div>
      <div class="row"><span class="label">Chave PIX</span><span class="value" id="key">—</span></div>
      <div class="row"><span class="label">Provider payout id</span><span class="value" id="providerId">—</span></div>
      <div class="row"><span class="label">Status</span><span id="status" class="badge badge--pending"><span class="dot"></span>—</span></div>
      <div class="kv">
        <div><div class="label">Usuário</div><div class="v" id="user">—</div></div>
        <div><div class="label">Conciliação</div><div class="v" id="variance">—</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Simular evento do Asaas</h2>
      <p class="hint">Cada botão envia um webhook assinado para <code>/webhooks/pix</code>.</p>
      <div class="actions">
        <button class="btn-ok" id="paid" disabled>✓ TRANSFER_PAID · confirmar PIX</button>
        <button class="btn-fail" id="failed" disabled>✕ TRANSFER_FAILED · falha + estorno</button>
        <button class="btn-new" id="create">＋ Nova solicitação de R$ 20</button>
        <button class="btn-ghost" id="refresh">↻ Atualizar estado</button>
      </div>
      <div class="log" id="log">Nenhum evento ainda.</div>
      <p class="note">Fluxo: solicitação → débito no ledger → provider cria transferência → webhook confirma → saque pago. Falha dispara <code>payout_refund</code> automático e a conciliação continua com variância R$ 0,00.</p>
    </div>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
let current = null;
const fmt = (c) => 'R$ ' + (c/100).toFixed(2).replace('.', ',');
function badge(status){
  const map={pending:'Pendente',paid:'Pago',failed:'Falhou'};
  $('status').className='badge badge--'+status;
  $('status').innerHTML='<span class="dot"></span>'+map[status];
}
async function load(){
  const state = await fetch('/control/state').then(r=>r.json());
  current = state.payout;
  if(current){
    $('payout-sub').textContent = 'payout ' + current.id + ' · criado ' + new Date(current.createdAt).toLocaleTimeString('pt-BR');
    $('amount').textContent=fmt(current.amountCents);
    $('fee').textContent=fmt(current.feeCents);
    $('net').textContent=fmt(current.netCents);
    $('key').textContent=current.pixKeyMasked;
    $('providerId').textContent=current.providerPayoutId||'—';
    $('user').textContent=current.userName;
    badge(current.status);
    $('paid').disabled=current.status!=='pending';
    $('failed').disabled=current.status!=='pending';
  }
  $('variance').textContent = state.reconciliation
    ? (state.reconciliation.balanced ? 'OK · R$ 0,00' : 'DIVERGÊNCIA')
    : '—';
  const list = state.events||[];
  $('log').innerHTML = list.length
    ? list.map(e=>'<div><b>'+e.event+'</b> · HTTP '+e.httpStatus+' · '+new Date(e.at).toLocaleTimeString('pt-BR')+'</div>').join('')
    : 'Nenhum evento ainda.';
}
async function simulate(event){
  const transfer = current && current.providerPayoutId;
  if(!transfer){return;}
  const res = await fetch('/control/transfers/'+encodeURIComponent(transfer)+'/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event})});
  await res.json();
  await load();
}
$('paid').onclick=()=>simulate('TRANSFER_PAID');
$('failed').onclick=()=>simulate('TRANSFER_FAILED');
$('create').onclick=async()=>{ await fetch('/control/create-payout',{method:'POST'}); await load(); };
$('refresh').onclick=load;
load();
setInterval(load, 4000);
</script>
</body></html>`;

const server = http.createServer(async (req, res) => {
 try {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/demo')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/wano-logo.png') {
    const file = path.resolve(__dirname, '..', 'apps/admin/public/wano-logo.png');
    try {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  // --- Asaas-compatible API -------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/v3/transfers') {
    if (req.headers.access_token !== ASAAS_API_KEY) {
      json(res, 401, { errors: [{ description: 'invalid access_token' }] });
      return;
    }
    const body = JSON.parse((await readBody(req)) || '{}');
    const id = `tr_${Date.now().toString(36)}${nextId++}`;
    const transfer = {
      id,
      status: 'PENDING',
      value: body.value,
      pixAddressKey: body.pixAddressKey,
      pixAddressKeyType: body.pixAddressKeyType,
      externalReference: body.externalReference,
      description: body.description,
      createdAt: new Date().toISOString(),
    };
    transfers.set(id, transfer);
    json(res, 200, transfer);
    return;
  }

  const transferMatch = url.pathname.match(/^\/v3\/transfers\/([^/]+)$/);
  if (req.method === 'GET' && transferMatch) {
    if (req.headers.access_token !== ASAAS_API_KEY) {
      json(res, 401, { errors: [{ description: 'invalid access_token' }] });
      return;
    }
    const transfer = transfers.get(decodeURIComponent(transferMatch[1]));
    if (!transfer) {
      json(res, 404, { errors: [{ description: 'transfer not found' }] });
      return;
    }
    json(res, 200, transfer);
    return;
  }

  // --- control room ---------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/control/state') {
    let payout = null;
    if (ADMIN_TOKEN) {
      const result = await api('/admin/payouts?status=all', { token: ADMIN_TOKEN });
      payout = result.body?.items?.[0] ?? null;
    }
    let reconciliation = null;
    if (ADMIN_TOKEN) {
      const result = await api('/admin/reconciliation', { token: ADMIN_TOKEN });
      reconciliation = result.body ?? null;
    }
    json(res, 200, { transfers: [...transfers.values()], events, payout, reconciliation });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/control/create-payout') {
    if (!USER_TOKEN) {
      json(res, 400, { error: 'USER_TOKEN missing' });
      return;
    }
    const result = await api('/payouts', {
      method: 'POST',
      token: USER_TOKEN,
      headers: { 'Idempotency-Key': `sim-${Date.now()}` },
      body: JSON.stringify({ amountCents: 2000, pixKey: 'marina@example.com', pixKeyType: 'email' }),
    });
    json(res, result.status, result.body);
    return;
  }

  const eventMatch = url.pathname.match(/^\/control\/transfers\/([^/]+)\/event$/);
  if (req.method === 'POST' && eventMatch) {
    const transfer = transfers.get(decodeURIComponent(eventMatch[1]));
    if (!transfer) {
      json(res, 404, { error: 'transfer not found' });
      return;
    }
    const body = JSON.parse((await readBody(req)) || '{}');
    const event = body.event === 'TRANSFER_FAILED' ? 'TRANSFER_FAILED' : 'TRANSFER_PAID';
    transfer.status = event === 'TRANSFER_PAID' ? 'DONE' : 'FAILED';
    const hook = await webhookFor(transfer, event, event === 'TRANSFER_FAILED' ? 'Conta de destino inválida (sandbox)' : undefined);
    json(res, 200, { transfer, webhook: hook });
    return;
  }

  json(res, 404, { error: 'not found' });
 } catch (error) {
  try { json(res, 500, { error: error instanceof Error ? error.message : 'internal error' }); } catch {}
 }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Asaas simulator listening on http://127.0.0.1:${PORT}`);
  console.log(`API: ${API_URL} · admin token: ${ADMIN_TOKEN ? 'yes' : 'no'} · user token: ${USER_TOKEN ? 'yes' : 'no'}`);
});

