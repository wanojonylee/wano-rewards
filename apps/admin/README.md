# WANO Rewards — admin (operations dashboard)

Vite + React + TypeScript dashboard for the people running the recycling network:
PIX payouts, redemption fulfilment, campaigns, rewards, fleet status and deposits.

## Run

```bash
npm install
cp .env.example .env       # optional: point at a live API
npm run dev                # http://127.0.0.1:5174
```

Without `VITE_API_URL` the dashboard runs on **mock data** (ships with realistic
seeded PIX/redeem/campaign rows) so the UI can be reviewed with no backend.

With an API URL, log in with an **admin account** (OTP):

- Phone: `+55 11 98888-0000` · code `123456` (dev mode)
- The app verifies the JWT `role === "admin"` claim before entering.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | KPIs, 14-day collection chart, fleet health, recent redemptions |
| `/payouts` | PIX queue: approve, retry failed, manual fail (refunds) |
| `/reconciliation` | Ledger vs provider proof, variance, outstanding liabilities |
| `/redemptions` | Codes by status, mark fulfilled |
| `/campaigns` | Create/edit brand campaigns and condo challenges |
| `/rewards` | Create/edit catalogue items, stock and status |
| `/machines` | Fleet status, fill level and collection priority |
| `/deposits` | Deposits with accept/reject reasons, CSV export |

## Languages

The dashboard is localised to **Traditional Chinese (`zh-Hant`, default)** and **English**.
Switch language from the topbar (logged in) or the login card; the choice is persisted in
`localStorage` under `wano.admin.locale` and `<html lang>` follows it. Every UI string —
navigation, page copy, KPIs, table headers, statuses, toasts, forms and demo/mock content —
comes from the dictionaries in `src/lib/i18n.tsx`; dates in `src/lib/format.ts` use `zh-TW`/`en-US`,
while BRL currency formatting is intentionally unchanged. Live API content is displayed as stored by
the backend. When adding a string, add the key to **both** locale dictionaries and call `t('key')`.

## Build & deploy

```bash
npm run build        # dist/
npm run preview      # http://127.0.0.1:4174
```

- **Vercel/Netlify**: build `dist`, SPA fallback to `index.html`.
- **Nginx**: `try_files $uri $uri/ /index.html;`
- **Docker**:

```bash
docker build -t wano-admin .
docker run -p 8080:80 wano-admin
```

`VITE_API_URL` is baked at build time, so each environment needs its own build.
CORS on the API must allow the dashboard origin (or any origin in dev).

## Design

Warm paper background, forest-green sidebar, Instrument Serif headlines and
Manrope UI — same design language as the mobile app. WANO logo lives in `public/`.

