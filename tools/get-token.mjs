const BASE = process.env.API_URL || 'http://127.0.0.1:8787/api/v1';

const otp = await fetch(`${BASE}/auth/request-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: '+5511999990000' }),
}).then((r) => r.json());

const verify = await fetch(`${BASE}/auth/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: '+5511999990000', code: otp.devCode ?? '123456', locale: 'pt-BR' }),
}).then((r) => r.json());

if (!verify.accessToken) {
  console.error('login failed', verify);
  process.exit(1);
}
console.log(verify.accessToken);
