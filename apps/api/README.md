# RecIO Rewards API

Production-shaped REST API for the RecIO Rewards mobile app (reverse vending
machines, recycling points, cashback, rewards and Pix payouts in Brazil).

**Stack:** Node 24 · TypeScript (ESM, native type stripping) · Express 5 ·
`node:sqlite` (`DatabaseSync`, zero native deps) · Zod · Stripe SDK · JWT ·
Helmet · CORS · rate limiting.

Base URL (dev): `http://localhost:8787/api/v1` · JSON · camelCase · money in
integer cents (BRL) · points as integers · ISO-8601 UTC timestamps.

---

## Quick start

```bash
cd apps/api
cp .env.example .env            # optional: defaults already work in dev
npm install
npm run seed                    # creates data/recio.db with the demo dataset
npm run dev                     # http://localhost:8787/api/v1
```

No `.env` is required for local development: the API defaults to
`AUTH_DEV_MODE=true`, `DEMO_MODE=true`, `AUTO_SEED=true`, port `8787`, and an
insecure dev JWT secret (production refuses to boot with that secret).

```bash
curl http://localhost:8787/health
# {"ok":true,"version":"1.0.0","mode":"demo","stripe":"unconfigured","uptimeSec":1}
```

### Demo accounts

| Role | Phone | Notes |
| --- | --- | --- |
| **User** | `+5511999990000` | Marina Costa, Forest tier, 1.860 pts, R$ 42,70, referral `MARINA10` |
| Admin | `+5511988880000` | metrics, CSV, campaign/reward CRUD, fulfilment, box level |
| Partner | `+5511977770000` | Quiosque Aurora cashier (`POST /redemptions/:id/mark-used`) |

OTP flow in dev: `POST /auth/request-otp` returns `devCode: "123456"`; the code
`123456` is always accepted. Codes are single-use with a 5 minute TTL and a
5 attempt budget.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run the TS sources directly on port 8787 (`node src/index.ts`) |
| `npm run dev:watch` | Same with `node --watch` |
| `npm run seed` | **Idempotent reset** of the demo database (`data/recio.db`) |
| `npm run build` | `tsc` → `dist/` + copy `schema.sql` |
| `npm run start` | Run the compiled build (`node dist/index.js`) |
| `npm test` | Sequential `node:test` + supertest suite (isolated DB per file) |
| `npm run test:node` | Same suite through `node --test` (needs child-process spawn) |
| `npm run typecheck` | `tsc --noEmit` for `src/` and `tests/` |
| `node scripts/inspect-db.mjs` | Print a compact summary of the SQLite database |
| `powershell -File scripts/verify-smoke.ps1` | Live end-to-end smoke test against port 8787 |

`npm run seed` deletes every row and recreates the demo dataset. It is safe to
run at any time (e.g. before a demo) and does **not** run automatically on every
boot (only when `AUTO_SEED=true` and the `users` table is empty).

---

## Seeded demo dataset

* **Edifício Aurora** (Pinheiros, São Paulo) with 3 towers, 8 RVMs — 6 online,
  1 full, 1 in maintenance, each with materials, fill level, hours and distance.
* **Marina Costa** with 90 days of history: 12 completed sessions, 45 deposits
  (43 accepted, 2 rejected for anti-fraud), 33 ledger entries, 3 redemptions
  (2 active), 6 notifications (2 unread), referral `MARINA10`, Forest tier
  (lifetime 4.110 pts), 1.860 points, R$ 42,70 credit / R$ 22,70 withdrawable.
* **14 rewards** (voucher/product/experience/donation) with the exact
  `imageKey` set: coffee, market, cinema, transit, gym, donation, bottle, bag,
  plant, ticket, icecream, bookstore, streaming, bike.
* **6 campaigns**: Outubro Circular (2x PET), Danone Circular (brand +50 pts),
  Desafio Aurora (condo challenge), Alumínio Turbo (2x aluminium weekend),
  Indique e Ganhe (referral boost), Semana Sem Desperdício (glass).
  Progress bars use a seeded offline baseline (bulk collections/partners) plus
  live deposits, so the demo shows realistic 40–75% progress.
* **8 leaderboard peers** with Portuguese names, distributed across the towers,
  so condo/building ranks and the 30-day leaderboard are populated.

---

## API conventions

* Auth: `Authorization: Bearer <accessToken>` (JWT HS256, 30 days) plus an
  opaque refresh token (hashed at rest, rotated on use; reuse revokes the
  family).
* Errors: `{ "error": { "code", "message", "details? }, "requestId" }`.
  Common codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `RATE_LIMITED`, `INVALID_CODE`, `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`,
  `SESSION_ALREADY_ACTIVE`, `SESSION_NOT_ACTIVE`, `MACHINE_UNAVAILABLE`,
  `MACHINE_FULL`, `INSUFFICIENT_POINTS`, `INSUFFICIENT_CREDIT`, `OUT_OF_STOCK`,
  `REWARD_EXPIRED`, `DELIVERY_REQUIRED`, `IDEMPOTENCY_CONFLICT`,
  `PAYOUT_TOO_SMALL`, `PAYOUT_TOO_LARGE`, `PAYOUT_DAILY_CAP`,
  `PAYOUT_INVALID_STATE`, `PAYOUT_PROVIDER_UNAVAILABLE`, `INVALID_SIGNATURE`.
* Pagination: `{ items, nextCursor }`, `?cursor=&limit=1..50`.
* Idempotency: `Idempotency-Key` on redeem / checkout / payout. The request
  hash + response are stored for 24h keyed by `(user, endpoint, key)`; a replay
  returns the original response with `"replayed": true`; the same key with a
  different body returns `409 IDEMPOTENCY_CONFLICT`.
* Rate limits: OTP `3/min` per identifier and `10/min` per IP, verify `10/min`,
  redeem `20/min` per user, checkout `10/min`, payout `5/min`, global `300/min`.
* Every request gets an `X-Request-Id` (or reuses `X-Request-Id`), included in
  logs and error payloads.

---

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | – | also at `/api/v1/health` |
| POST | `/auth/request-otp` | – | `{ identifier, channel }` → `{ sent, devCode?, expiresIn }` |
| POST | `/auth/verify` | – | `{ identifier, code, locale }` → tokens + user + `isNewUser` |
| POST | `/auth/refresh` | – | rotates the refresh token |
| POST | `/auth/logout` | optional | revokes the refresh token (or the whole family) |
| GET | `/me` | user | `{ user, wallet, tier, stats, rank }` |
| PATCH | `/me` | user | `{ name?, email?, locale?, marketingOptIn? }` → User |
| GET | `/me/export` | user | LGPD portability → `202 { jobId }`, JSON on disk |
| DELETE | `/me` | user | `{ confirm: "DELETE" }` → 202; pseudonymized after 30 days |
| POST | `/me/consent` | user | `{ lgpd, marketing }` → `{ consent }` |
| GET | `/home` | user | wallet/tier/stats/rank/campaigns/recent/nearbyMachine/weeklyGoal |
| GET | `/impact` | user | last 6 months, material split, lifetime totals, badges |
| GET | `/wallet` | user | points / credit / withdrawable / expiring |
| GET | `/wallet/entries` | user | `?type=&cursor=&limit=` statement, cursor-paginated |
| POST | `/sessions/start` | user | `{ machineCode, source }` → 201 session + `pollAfterMs` |
| GET | `/sessions/:id` | user | session, deposits, totals, receipt |
| POST | `/sessions/:id/complete` | user | finalizes and credits once |
| POST | `/sessions/:id/simulate-deposit` | user | demo only (`DEMO_MODE=true`) |
| POST | `/ingest/deposits` | machine key | `X-Machine-Key`; idempotent by `eventId` |
| GET | `/rewards` | user | `?category=&search=&cursor=&limit=` |
| GET | `/rewards/:id` | user | `{ reward, related }` |
| POST | `/rewards/:id/redeem` | user + idempotency | `{ quantity, delivery? }` |
| GET | `/redemptions` | user | `?status=active\|used\|expired\|fulfilled` |
| GET | `/redemptions/:id` | user | `{ redemption }` |
| POST | `/redemptions/:id/mark-used` | partner/admin | idempotent cashier flow |
| GET | `/campaigns` | user | active campaigns + progress + joined |
| GET | `/campaigns/:id` | user | `{ campaign, leaderboard, userPosition }` (id or slug) |
| GET | `/leaderboard` | user | `?scope=condo\|building\|city&campaignId=&days=` |
| GET | `/payments/packs` | user | server-authoritative packs |
| POST | `/payments/checkout` | user + idempotency | Stripe or `mock://checkout/<id>` |
| GET | `/payments/:id` | user | payment state |
| POST | `/payments/:id/mock-complete` | user | demo/mock provider only, credits once |
| POST | `/webhooks/stripe` | Stripe signature | raw body; idempotent by event id |
| POST | `/webhooks/pix` | PIX provider token | raw body; idempotent by provider event id |
| POST | `/payouts` | user + idempotency | min 2000¢, max 50000¢/request, 50000¢/day, fee 150¢ |
| GET | `/payouts` | user | payout history |
| POST | `/payments/mini-market` | user | debits credit, returns 6-digit code |
| GET | `/notifications` | user | `{ items, unread }` |
| POST | `/notifications/read-all` | user | marks all read |
| POST | `/notifications/:id/read` | user | marks one read |
| GET | `/referral` | user | `{ code, link, invited, earnedPoints, ... }` |
| POST | `/referral/apply` | user | `{ code }` → `{ applied, bonusPoints }` |
| GET | `/machines` | – | `?lat=&lng=` sorted by distance |
| GET | `/machines/:code` | – | `{ machine, recentImpact }` |
| GET | `/config` | – | economy, legal, tiers, limits, packs |
| GET | `/admin/metrics` | admin | KPIs (DAU, deposits, points, redemption rate, payouts) |
| GET | `/admin/deposits.csv` | admin | streaming `text/csv` (`?from=&to=`) |
| POST/PATCH | `/admin/campaigns` `/admin/campaigns/:id` | admin | CRUD + audit |
| POST/PATCH | `/admin/rewards` `/admin/rewards/:id` | admin | CRUD + audit |
| GET | `/admin/redemptions` | admin | `?status=` with user info |
| POST | `/admin/redemptions/:id/fulfill` | admin | marks fulfilled + notifies |
| POST | `/admin/machines/:code/box-level` | admin | `{ fillPercent }`, drives full/online |
| GET | `/admin/payouts` | admin | `?status=pending\|paid\|failed\|all&cursor=&limit=` |
| POST | `/admin/payouts/:id/paid` | admin | marks a pending Pix payout as paid |
| POST | `/admin/payouts/:id/retry` | admin + idempotency | failed payout → re-debit + provider retry |
| POST | `/admin/payouts/:id/fail` | admin | manual failure with refund |
| GET | `/admin/reconciliation` | admin | `?from=&to=` payout + wallet reconciliation |

All admin mutations write `audit_logs` (actor, action, entity, before/after, IP).

---

## Economy rules (centralized in `src/config/economy.ts`)

| Material | Points/item | Cashback/item | Approx. weight | CO₂e per gram |
| --- | --- | --- | --- | --- |
| PET | 10 | 5¢ | 28 g | 1.5 g |
| ALUMINUM | 15 | 8¢ | 15 g | 9.1 g |
| GLASS | 6 | 3¢ | 300 g | 0.5 g (approx.) |
| HDPE | 12 | 6¢ | 30 g | 1.5 g |
| PP | 8 | 4¢ | 25 g | 1.5 g |
| PS/HIPS | 6 | 3¢ | 20 g | 1.5 g |

Tier multipliers apply to **points only** (round half up), computed from
lifetime points: Semente 0+ (1.0), Broto 500+ (1.05), Floresta 2000+ (1.1),
Guardião 5000+ (1.2). Campaign multipliers stack multiplicatively with the tier
multiplier; campaign bonus points are added after rounding.

Top-up packs (server-authoritative, client amounts are ignored):

| Pack | Price | Credit | Bonus points | Withdrawable |
| --- | --- | --- | --- | --- |
| `pack-20` | R$ 20 | R$ 20 | 50 | no |
| `pack-50` | R$ 50 | R$ 50 | 150 | no |
| `pack-100` | R$ 100 | R$ 100 | 400 | no |

Cashback credit **is** withdrawable; top-up credit is not. Pix payouts: min
R$ 20, max R$ 500 per request, R$ 500/day, fee R$ 1.50
(`PIX_PAYOUT_FEE_CENTS`, charged to the user). The provider receives
`netCents = amountCents - feeCents`; the ledger records the full user debit.

---

## How money is kept correct

All points/credit/withdrawable changes go through `src/services/ledger.ts`:

* one SQLite transaction (`BEGIN IMMEDIATE`) per movement;
* the wallet row is updated **and** a `ledger_entries` row is inserted with
  `balance_after_points`, `balance_after_credit_cents`,
  `balance_after_withdrawable_cents`;
* negative balances are rejected (`INSUFFICIENT_POINTS` / `INSUFFICIENT_CREDIT`)
  and `withdrawable <= credit` is enforced;
* `idempotency_key` is UNIQUE, so the same business event can never credit
  twice (session completion, top-up, refund, payout, referral bonus);
* payout failures/cancellations refund the **full gross** `amountCents` with
  ledger key `payout_refund:<payoutId>` (`type = payout_refund`), so a webhook
  replay can never refund twice and `withdrawable <= credit` keeps holding;
* lifetime points (tier input) only grow on positive point movements.

Redemptions decrement stock atomically (`UPDATE ... WHERE stock >= ?`), then
write the ledger debit and the redemption row in the same transaction.

---

## Stripe test-mode walkthrough

1. Put your test keys in `.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen`
   ```

2. Start the API (`npm run dev`) and forward webhooks:

   ```bash
   stripe listen --forward-to localhost:8787/api/v1/webhooks/stripe
   ```

   Copy the `whsec_...` printed by the CLI into `.env` and restart the API.

3. Create a checkout from the app/API:

   ```bash
   curl -s -X POST localhost:8787/api/v1/payments/checkout \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d '{"packId":"pack-50","successUrl":"recio://wallet?status=success","cancelUrl":"recio://wallet?status=cancel"}'
   ```

   The response contains `payment.checkoutUrl` (a real Stripe Checkout URL) and
   `provider: "stripe"`. The API builds `line_items` and the amount exclusively
   from the server-side pack; `metadata` carries `{ paymentId, userId }`.

4. Pay with the test card `4242 4242 4242 4242`. `checkout.session.completed`
   arrives at the webhook, is verified with the raw body + signature, stored in
   `webhook_events` (unique by event id) and credits the wallet exactly once.

5. Optional: trigger events without the UI:

   ```bash
   stripe trigger checkout.session.completed
   ```

   Events created outside the API may not carry our metadata, in which case the
   handler ignores them safely (200, no credit).

**Without a Stripe key** the provider is `mock`: checkout returns
`mock://checkout/<id>` and `POST /payments/:id/mock-complete` credits the
wallet. The mock endpoint refuses to run when a real Stripe key is configured.

Security: signature verification uses `stripe.webhooks.constructEvent` against
the **raw** body (`express.raw` is mounted before `express.json`); invalid
signatures return `400 INVALID_SIGNATURE`; replaying a processed event returns
`{ received: true, duplicate: true }` without side effects.

---

## PIX payouts (provider-agnostic)

All PIX integrations implement `PixProvider` (`src/services/pix/types.ts`):
`name`, `createPayout`, `getPayoutStatus`, `verifyWebhook`. The payout domain
(`src/services/payouts.ts`) never imports a provider SDK — no heavyweight
dependencies, built-in `fetch` only.

| Provider | Selected when | Behaviour |
| --- | --- | --- |
| `mock` | default in dev/test (`PIX_PROVIDER` unset) | returns `mock_pix_*` / `pending`; a Pix key ending in `@fail.test` fails deterministically (refund path); webhooks are unsigned but payload-validated |
| `asaas` | `PIX_PROVIDER=asaas` | real Asaas API v3 (sandbox by default): `POST {ASAAS_BASE_URL}/v3/transfers`, `GET /v3/transfers/:id`, token-authenticated webhooks |

Provider selection fails closed: outside production an invalid/missing
selection (or `asaas` without `ASAAS_API_KEY`) logs a warning and falls back to
mock; **in production** it throws `503 PAYOUT_PROVIDER_UNAVAILABLE` when a
payout is attempted, before the wallet is debited.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PIX_PROVIDER` | `mock` dev/test, required in prod | `mock \| asaas` |
| `PIX_PAYOUT_FEE_CENTS` | `150` | fee charged to the user (R$ 1.50) |
| `PIX_MIN_CENTS` | `2000` | minimum payout (R$ 20.00) |
| `PIX_DAILY_CAP_CENTS` | `50000` | daily cap per user (R$ 500.00) |
| `ASAAS_API_KEY` | – | Asaas API key (sandbox or production) |
| `ASAAS_BASE_URL` | `https://sandbox.asaas.com/api` | Asaas API root (no trailing `/v3`) |
| `ASAAS_WEBHOOK_TOKEN` | – | shared token Asaas sends as `asaas-access-token` |

`GET /config` exposes `limits.payoutMinCents`, `payoutMaxPerRequestCents`,
`payoutDailyCapCents` and `payoutFeeCents` (defaults: 2000 / 50000 / 50000 /
150 cents).

### Payout lifecycle

```
POST /payouts  { amountCents, pixKey, pixKeyType }
  │  Idempotency-Key (24h replay, same body → same payout)
  ├─ validate min / max / withdrawable / daily cap
  ├─ INSERT payout(pending, amount, fee, net, provider)
  │    └─ ledger debit: credit -amount, withdrawable -amount   (type = payout)
  ├─ provider.createPayout(netCents)
  │    ├─ pending ──────────────► wait for webhook / admin /paid
  │    ├─ paid ─────────────────► status paid + paid_at + notification
  │    └─ failed / provider error► refund amount (type = payout_refund)
  │                                status failed + failure_reason + notification
  └─ 201 { payout, replayed? }

POST /webhooks/pix  (raw body, provider token)
  ├─ verify token ─► dedupe by provider event id (webhook_events)
  ├─ TRANSFER_PAID             → paid (only from pending)
  ├─ TRANSFER_FAILED/CANCELLED → refund amount exactly once → failed
  └─ unknown event / unknown payout → 200 { received, ignored: true }

POST /admin/payouts/:id/retry  (failed only)
  └─ re-debit amount → provider.createPayout → pending/paid/failed
     guarded by `retry_of` (max one active retry) + optional Idempotency-Key

POST /admin/payouts/:id/fail
  └─ refund amount exactly once → failed (idempotent for already-failed)
```

Every failure path uses ledger idempotency key `payout_refund:<payoutId>` and a
`status = 'pending'` guard, so webhook replays, provider retries and admin
double-clicks never refund twice. `withdrawable <= credit` is preserved because
both balances move by the same amount.

### Admin dashboard endpoints

All require `role=admin`; mutations write `audit_logs` (`payout.paid`,
`payout.retry`, `payout.fail`).

`GET /api/v1/admin/payouts?status=pending|paid|failed|all&cursor=&limit=1..100`
(`rejected` is also accepted for legacy rows):

```json
{
  "items": [
    {
      "id": "pyt_9f3k2...",
      "userName": "Marina Costa",
      "userPhone": "+5511999990000",
      "amountCents": 2500,
      "feeCents": 150,
      "netCents": 2350,
      "pixKeyMasked": "us**@example.com",
      "status": "pending",
      "provider": "mock",
      "providerPayoutId": "mock_pix_ab12...",
      "failureReason": null,
      "createdAt": "2026-10-20T18:00:00.000Z",
      "paidAt": null
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOi...",
  "totals": { "count": 12, "amountCents": 30500, "feeCents": 1800, "netCents": 28700 }
}
```

`totals` ignores the cursor (whole filtered set). `POST /admin/payouts/:id/paid`
`{ note?, providerPayoutId? }`, `POST /admin/payouts/:id/fail` `{ reason? }` and
`POST /admin/payouts/:id/retry` (optional `Idempotency-Key`) all return the
standard payout view: `{ payout }` (`retry` responds `201`, the others `200`).
Errors: `403 FORBIDDEN` for non-admin, `404 NOT_FOUND`, `409
PAYOUT_INVALID_STATE` for paid→fail / pending→retry / double active retry, and
`409 INSUFFICIENT_CREDIT` when a retry cannot re-debit.

`GET /api/v1/admin/reconciliation?from=2026-10-01&to=2026-10-31`
(defaults to the last 30 days; accepts `YYYY-MM-DD` or ISO timestamps):

```json
{
  "range": { "from": "2026-10-01T00:00:00.000Z", "to": "2026-10-31T23:59:59.999Z" },
  "counts": { "total": 5, "pending": 1, "paid": 3, "failed": 1, "refunded": 1 },
  "requestedCents": 12500,
  "paidCents": 7500,
  "pendingCents": 2000,
  "failedCents": 3000,
  "refundedCents": 3000,
  "feeCents": 600,
  "ledgerPayoutCents": 9500,
  "varianceCents": 0,
  "pointsOutstanding": 1860,
  "creditOutstandingCents": 4270,
  "withdrawableOutstandingCents": 2270,
  "balanced": true,
  "providers": [
    {
      "provider": "mock",
      "counts": { "total": 5, "pending": 1, "paid": 3, "failed": 1, "refunded": 1 },
      "requestedCents": 12500,
      "paidCents": 7500,
      "pendingCents": 2000,
      "failedCents": 3000,
      "refundedCents": 3000,
      "feeCents": 600,
      "ledgerPayoutCents": 9500,
      "varianceCents": 0
    }
  ],
  "generatedAt": "2026-10-20T18:05:00.000Z"
}
```

`varianceCents = ledgerPayoutCents - (paidCents + pendingCents)`; it is `0`
when every pending/paid payout is backed by its gross ledger debit and every
failure was refunded. `balanced` checks the aggregate wallet invariant
(`withdrawable <= credit`) and that wallet credit/withdrawable equal the ledger
sums. Failed (refunded) payouts therefore do not move either number.

### Testing PIX locally

Mock provider (default — no credentials):

```bash
# 1. login and create a payout (use the dev OTP 123456)
curl -s -X POST localhost:8787/api/v1/payouts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"amountCents":2500,"pixKey":"user@example.com","pixKeyType":"email"}'

# 2. simulate the provider confirming the transfer
curl -s -X POST localhost:8787/api/v1/webhooks/pix \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test_paid_1","event":"TRANSFER_PAID","transfer":{"id":"mock_pix_...","externalReference":"pyt_..."}}'

# 3. simulate a failure on another payout (refund exactly once)
curl -s -X POST localhost:8787/api/v1/webhooks/pix \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test_failed_1","event":"TRANSFER_FAILED","transfer":{"id":"mock_pix_..."},"failureReason":"Conta inválida"}'
```

A Pix key ending in `@fail.test` makes `POST /payouts` fail immediately (the
refund runs inside the request), which is the fastest way to exercise the
failure path.

Asaas sandbox:

1. Put `PIX_PROVIDER=asaas`, `ASAAS_API_KEY=...` and `ASAAS_WEBHOOK_TOKEN=...`
   into `.env`; keep `ASAAS_BASE_URL=https://sandbox.asaas.com/api`.
2. Register `https://<public-host>/api/v1/webhooks/pix` in the Asaas sandbox
   dashboard and configure the same webhook token there.
3. Create a payout; the API sends `value = netCents/100`,
   `pixAddressKey`, `pixAddressKeyType`, `externalReference = payoutId`,
   `description` with the `access_token` header.
4. Asaas posts events with the `asaas-access-token` header. A mismatched/missing
   token returns `400 INVALID_SIGNATURE`; replayed event ids return
   `{ received: true, duplicate: true }`.

`POST /webhooks/pix` is mounted with `express.raw` before `express.json`, just
like the Stripe webhook, so the exact provider bytes are verified.

---

## LGPD (data protection)

* Consent timestamps (`lgpd_consent_at`) are captured on first login and via
  `POST /me/consent`; marketing opt-in is stored separately.
* `GET /me/export` writes a complete JSON portability file to
  `data/exports/<jobId>.json` and records an audit entry.
* `DELETE /me` requires `{ "confirm": "DELETE" }`: access is revoked
  immediately (refresh tokens revoked, JWT rejected), data is pseudonymized
  after a 30-day grace period (phone/email/name removed, notifications and
  delivery addresses cleared, referral links detached). Financial ledger rows
  are retained for accounting without direct identifiers. Accounts can be
  reactivated during the grace window by logging in again.
* Pseudonymization runs on boot and is idempotent.

---

## Project layout

```
apps/api
├── src
│   ├── app.ts                 Express app factory (CORS/helmet/webhook ordering)
│   ├── index.ts               Boot: DB, seed, graceful shutdown
│   ├── env.ts                 Typed env (loads .env without overriding process env)
│   ├── logger.ts              Tiny JSON/pretty logger
│   ├── errors.ts              ApiError + error codes
│   ├── types.ts               Row/domain types
│   ├── config/
│   │   ├── economy.ts         Materials, tiers, packs, limits (single source of truth)
│   │   └── demo-catalog.ts    Realistic EAN/SKU catalog for simulations
│   ├── db/
│   │   ├── schema.sql         Full schema + indexes (auto-applied on boot)
│   │   └── index.ts           DatabaseSync, WAL, FK, prepared statements, transactions
│   ├── services/              ledger, auth, sessions, awards, rewards, campaigns,
│   │                          leaderboard, payments, payouts, payout-webhook,
│   │                          payout-reconciliation, referrals, lgpd, admin,
│   │                          machines, notifications, profile, idempotency,
│   │                          audit; pix/ (PixProvider, mock, Asaas)
│   ├── middleware/            auth (JWT/roles), validation (Zod), errors, rate limits
│   ├── routes/                auth, me, home, sessions, ingest, rewards, campaigns,
│   │                          payments, notifications, referral, machines, config,
│   │                          health, admin, webhook
│   └── seed/seed.ts           Idempotent demo dataset
├── scripts/                   build assets, test runner, DB inspector, smoke test
├── tests/                     node:test + supertest (auth, sessions, rewards, payments,
│                              payouts, pix-provider, LGPD, leaderboard, home)
├── data/                      SQLite + exports (gitignored)
├── Dockerfile
└── docker-compose.yml
```

---

## Tests

```bash
npm test
```

Each test file runs in its own Node process against a fresh temporary SQLite
database (`DB_PATH=./data/test-*.db`, removed afterwards). Covered flows:

* OTP request/verify, wrong code, attempt cap, expiry, refresh rotation + reuse
  detection, auth guard.
* `/me` and `/home` shapes, tier/rank/stats, `/config`, machine discovery.
* Session lifecycle, simulate deposits, completion, ledger↔wallet
  reconciliation, idempotent completion, machine full/maintenance, machine
  ingestion (idempotent by `eventId`, weight rejection).
* Redemption success, insufficient points, out of stock, delivery requirement,
  idempotent replay, conflict, partner `mark-used`.
* Mock checkout + `mock-complete` credits exactly once; Stripe webhook signature
  verification, replay dedupe, refund reversal.
* Payout fee math (gross debit, net to provider), min/max/withdrawable/daily cap,
  idempotent replay, mock provider happy path, `@fail.test` failure/refund,
  webhook paid transition, failed webhook refund exactly once (including
  different-event and replay guards), admin list/pagination/totals,
  mark-paid/retry/fail + audit, non-admin 403.
* Asaas adapter with `globalThis.fetch` stubbed: URL/body/`access_token`
  header, PENDING/IN_BANK/BANK_PROCESSING → pending, DONE → paid,
  FAILED/CANCELLED → failed, webhook token rejection, factory fallbacks.
* Reconciliation: `balanced: true`, `varianceCents: 0`, ledger/wallet cross
  checks, provider breakdown, still balanced after a failed (refunded) payout.
* LGPD export file, consent/profile update, deletion + pseudonymization.
* Leaderboard shape/order, campaign detail/leaderboard.

The suite currently has **39 tests across 9 files** (28 pre-existing + 11 new).

`npm test` uses `scripts/run-tests.mjs` because Node's `node --test` spawns one
child process per file (blocked in some restricted sandboxes). In unrestricted
environments you can also run `npm run test:node`.

---

## Deployment

### Docker Compose (recommended for a demo/staging host)

```bash
cd apps/api
cp .env.example .env
# set at least: JWT_SECRET=<32+ random bytes>, NODE_ENV=production
docker compose up -d --build
curl http://localhost:8787/health
```

`docker-compose.yml` mounts the named volume `recio-data` at `/app/data`, so
`recio.db`, its WAL files and LGPD exports survive container restarts. On an
empty volume set `AUTO_SEED=true` (demo) or run the seed explicitly:

```bash
docker compose exec api node dist/seed/seed.js
```

### Render / Fly.io

* Build: `npm ci && npm run build` (root directory `apps/api`).
* Start: `node dist/index.js`.
* **Attach a persistent disk/volume** and point `DB_PATH` at it, e.g.
  `/var/data/recio.db` (Render disk) or `/data/recio.db` (Fly volume). SQLite
  requires a single instance with a local volume — do not scale horizontally.
* Health check: `/health` (or `/api/v1/health`).
* Required env: `NODE_ENV=production`, `JWT_SECRET`, `DB_PATH`, `PIX_PROVIDER`
  (plus `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` when `asaas` is selected),
  optionally `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, `CORS_ORIGINS`.
* Enable `TRUST_PROXY=true` behind a load balancer so rate limits key on the
  client IP.
* Back up the volume (`.backup` / `sqlite3 ... ".backup"` / file snapshot
  including `-wal`). WAL mode is enabled.

The server shuts down gracefully on `SIGTERM`/`SIGINT` (closes the HTTP server,
then the database; 10s hard timeout), which fits container orchestrators.

### Scaling beyond one node → PostgreSQL

This implementation deliberately uses `node:sqlite` (zero native deps, single
file, perfect for demos). At scale, move to Postgres:

1. Replace `src/db/index.ts` with `pg` + a migration tool (Drizzle, Kysely,
   Prisma or plain SQL migrations); keep the `src/db/schema.sql` model — most
   types map directly (`TEXT` → `text`, `INTEGER` cents/points, `REAL` → numeric).
2. Enable Row-Level locking for wallet updates (`SELECT ... FOR UPDATE` inside
   the existing ledger transaction) or keep the single-statement atomic updates.
3. Keep `ledger_entries.idempotency_key` UNIQUE and the
   `(user_id, endpoint, key)` unique index on `idempotency_keys` — they carry the
   same guarantees in Postgres.
4. Move rate limiting to a shared store (Redis) and idempotency keys too if you
   run multiple instances.
5. Replace `id` prefixed strings with `uuid`/`nanoid` columns; JSON columns
   (`metadata_json`, `delivery_json`, webhook payloads) can become `jsonb`.
6. Run the seed against a staging database (`npm run seed` only targets
   `DB_PATH`).

---

## Contract notes (additive fields)

The mobile contract in `docs/api-contract.md` is implemented as specified. A
few responses include **additional** fields/endpoints that the app may use:

* `GET /config` also returns `tiers`, `limits` and `packs` (the app needs the
  payout limits and pack catalog without extra round trips).
* `GET /home` `weeklyGoal` includes `bonusPoints`, `weekStart`, `weekEnd`.
* `GET /leaderboard` `me` includes `total` and `percentile` (`percentile` is
  "top X%", i.e. `position / total * 100`).
* Redemptions expose `quantity`, `valueCents`, `delivery` and `fulfilledAt`.
* `GET /machines/:code` returns `recentImpact` for the last 30 days.
* `POST /payments/mini-market` responds `201` with `{ payment, wallet }` and the
  6-digit code in `payment.code`.
* `POST /admin/payouts/:id/paid` is provided so an admin can settle a pending
  Pix payout (the contract mentions the capability without a path). Payouts now
  also expose `provider`, `providerPayoutId`, `failureReason` and `retryOf`
  (additive; the mobile fields are unchanged), and `status` may be `failed`.
* Admin dashboard additions: `GET /admin/payouts`,
  `POST /admin/payouts/:id/retry`, `POST /admin/payouts/:id/fail` and
  `GET /admin/reconciliation`.
* `POST /sessions/:id/simulate-deposit` may return an **accepted=false** deposit
  (`DUPLICATE_GTIN`) to exercise the anti-fraud path; the client should render
  rejected items as such.
* Tier display names are localized (`Semente`, `Broto`, `Floresta`, `Guardião`)
  while the contract codes remain `seed|sprout|forest|guardian`.

---

## Security & operations checklist

* Helmet + CORS (Expo origins in production whitelist) + 1 MB JSON body limit.
* JWT HS256 with issuer check; refresh tokens stored only as SHA-256 hashes.
* OTPs stored hashed, single-use, TTL 5 min, attempt-capped, rate limited.
* Zod validation on every body/query/param; errors never leak stack traces.
* Access log lines include request id, route, status, duration, user id.
* Stripe raw-body signature verification; PIX provider token verification
  (`asaas-access-token`); webhook events deduped by provider event id.
* SQLite WAL + `busy_timeout=5000`; all multi-row writes inside transactions.
* No secrets in the repo: `.env` is gitignored, `.env.example` documents keys.


