# RecIO Rewards — API Contract v1

Base URL: `http://localhost:8787/api/v1` (dev) · JSON · camelCase · UTF-8
Auth: `Authorization: Bearer <accessToken>` (JWT, HS256, 30 days)
Errors: `{ "error": { "code": "STRING_CODE", "message": "Human readable", "details": {} } }`
Idempotency: mutating money/points endpoints accept `Idempotency-Key` header (UUID v4). Repeated key returns the original response with `replayed: true`.

## Conventions
- Money is integer cents in **BRL** (`creditCents`, `amountCents`). Never floats.
- Points are integers. 1 point has no fixed cash value; cashback is a separate ledger leg in cents.
- Timestamps are ISO-8601 UTC strings.
- Paginated lists: `{ items: [...], nextCursor: string | null }`, query `?cursor=&limit=20` (limit 1..50).
- All responses include `requestId` only in errors.

## Auth (OTP, passwordless)
`POST /auth/request-otp`
```json
{ "identifier": "+5511999990000", "channel": "sms" }
```
→ `200 { "sent": true, "devCode": "123456", "expiresIn": 300 }` (`devCode` only when `AUTH_DEV_MODE=true`)
Rate limit: 3/min per identifier, 10/min per IP.

`POST /auth/verify`
```json
{ "identifier": "+5511999990000", "code": "123456", "locale": "pt-BR" }
```
→ `200 { "accessToken": "...", "refreshToken": "...", "isNewUser": true, "user": User }`
Errors: `INVALID_CODE`, `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`.

`POST /auth/refresh` `{ "refreshToken": "..." }` → `{ "accessToken", "refreshToken" }`
`POST /auth/logout` → `204`

## User & wallet
`GET /me` → `{ user, wallet, tier, stats, rank }`
- `user`: `{ id, name, email, phone, locale, avatarColor, memberSince, consent: { lgpdAt, marketingOptIn } }`
- `wallet`: `{ points, creditCents, withdrawableCents, expiring: { points, at } | null }`
- `tier`: `{ code: "seed"|"sprout"|"forest"|"guardian", name, minPoints, nextTier, pointsToNext, multiplier, perks[] }`
- `stats`: `{ kgTotal, itemsTotal, co2SavedKg, sessionsTotal, currentStreakWeeks }`
- `rank`: `{ condo: { position, total, percentile }, building: { position, total } }`

`PATCH /me` `{ name?, email?, locale?, marketingOptIn? }` → `User`
`GET /me/export` → `202 { "jobId": "..." }` (LGPD data portability; email delivered)
`DELETE /me` `{ "confirm": "DELETE" }` → `202` (LGPD erasure; pseudonymized after 30-day grace)
`POST /me/consent` `{ "lgpd": true, "marketing": false }` → `{ consent }`

## Home aggregate
`GET /home` → `{ wallet, tier, stats, rank, campaigns[], recent[], nearbyMachine, weeklyGoal, greetingName }`
One round trip for the home screen; `recent` = last 5 ledger entries.

`GET /impact` → `{ months: [{ label, kg }], materials: [{ material, kg }], totals: { kg, co2Kg, items, sessions }, badges: [{ id, title, description, unlocked, progress: { current, target } | null }] }`
Personal impact screen: last 6 months, material split, lifetime totals, achievement badges.

## Recycling sessions (RVM)
`POST /sessions/start`
```json
{ "machineCode": "RVM-SP-001", "source": "qr" }
```
→ `201 { "session": { id, status: "active", machine, startedAt, expiresAt }, "pollAfterMs": 1500 }`
Errors: `MACHINE_UNAVAILABLE`, `MACHINE_FULL`, `SESSION_ALREADY_ACTIVE`.

`GET /sessions/:id` → `{ session: { id, status: "active"|"completed"|"expired", deposits[], totals: { items, weightGrams, points, cashbackCents, co2Grams }, receipt } }`

`POST /sessions/:id/complete` → `{ session }` (user pressed "finish on machine" / demo)
`POST /sessions/:id/simulate-deposit` (only when `DEMO_MODE=true`)
```json
{ "material": "PET" }
```
→ `{ deposit, totals }` — simulates the RVM ingesting an accepted package.

Machine-facing ingest (server-to-server):
`POST /ingest/deposits` header `X-Machine-Key: <key>`
```json
{
  "machineCode": "RVM-SP-001",
  "sessionToken": "…",
  "eventId": "uuid",
  "occurredAt": "2026-10-20T12:00:00Z",
  "items": [
    { "gtin": "7891000100103", "material": "PET", "weightGrams": 28, "accepted": true, "rejectReason": null, "skuName": "Água Crystal 500ml" }
  ]
}
```
→ `201 { "accepted": 1, "rejected": 0, "pointsAwarded": 12, "cashbackCents": 6 }`
Idempotent by `eventId`; unknown/expired token → `409 SESSION_NOT_ACTIVE`.

## Rewards
`GET /rewards?category=voucher|product|experience|donation&search=&cursor=` → `{ items: Reward[], nextCursor }`
`Reward`: `{ id, title, subtitle, category, partner, pointsCost, valueCents, imageKey, stock, stockLabel, isNew, highlight, terms, expiresAt }`

`GET /rewards/:id` → `{ reward, related[] }`
`POST /rewards/:id/redeem` header `Idempotency-Key`
```json
{ "quantity": 1, "delivery": { "name": "…", "line1": "…", "city": "…", "state": "…", "postalCode": "…" } }
```
→ `201 { redemption: { id, code, qrPayload, status, expiresAt, reward, pointsSpent }, wallet }`
Errors: `INSUFFICIENT_POINTS`, `OUT_OF_STOCK`, `REWARD_EXPIRED`, `DELIVERY_REQUIRED`.

`GET /redemptions?status=active|used|expired` → `{ items, nextCursor }`
`GET /redemptions/:id` → `{ redemption }`
`POST /redemptions/:id/mark-used` → `{ redemption }` (mini-market cashier endpoint, JWT role=partner)

## Campaigns & leaderboard
`GET /campaigns` → `{ items: Campaign[] }`
`Campaign`: `{ id, title, brand, subtitle, material, multiplier, bonusPoints, startsAt, endsAt, imageKey, accent, progress: { current, target, unit } | null, joined }`
`GET /campaigns/:id` → `{ campaign, leaderboard: LeaderboardRow[], userPosition }`
`GET /leaderboard?scope=condo|building|city&campaignId=` → `{ scope, period, rows: LeaderboardRow[], me }`
`LeaderboardRow`: `{ position, displayName, avatarColor, value, unit, isMe }`

## Payments (Stripe test mode)
`GET /payments/packs` → `{ items: [{ id, creditCents, bonusPoints, priceCents, currency: "BRL", label, badge }] }` (server maps pack → Stripe price; prices are server-authoritative)
`POST /payments/checkout` header `Idempotency-Key`
```json
{ "packId": "pack-50", "successUrl": "recio://wallet?status=success", "cancelUrl": "recio://wallet?status=cancel" }
```
→ `201 { payment: { id, status: "requires_payment", provider: "stripe"|"mock", checkoutUrl }, wallet }`
`GET /payments/:id` → `{ payment }`
`POST /payments/:id/mock-complete` (DEMO_MODE / no Stripe key only) → `{ payment, wallet }`
`POST /webhooks/stripe` (raw body, `Stripe-Signature`) → `200` — handles `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`; idempotent by event id. Credits wallet exactly once.

`POST /payouts` header `Idempotency-Key`
```json
{ "amountCents": 2500, "pixKey": "user@example.com", "pixKeyType": "email" }
```
→ `201 { payout: { id, status: "pending"|"paid", amountCents, feeCents, netCents, pixKeyMasked, estimatedAt } }`
Rules: min 2000, max 50000/day, only `withdrawableCents`.
`GET /payouts` → `{ items }`

`POST /payments/mini-market` `{ machineCode, amountCents }` → `{ payment, wallet }` (debits credit balance at partner mini-market, returns 6-digit code)

## Notifications & referral
`GET /notifications` → `{ items, unread }` · `POST /notifications/read-all` · `POST /notifications/:id/read`
`GET /referral` → `{ code, link, invited, earnedPoints, rewardPerFriend, rules }`
`POST /referral/apply` `{ "code": "…" }` → `{ applied: true, bonusPoints }`

## Machines
`GET /machines?lat=&lng=` → `{ items: [{ id, code, name, address, distanceMeters, status: "online"|"maintenance"|"full", materials[], fillPercent, hours }] }`
`GET /machines/:code` → `{ machine, recentImpact }`

## Config
`GET /config` → `{ currency: "BRL", locale: "pt-BR", locales: ["pt-BR","en"], pointsPerKg: {...}, materials[], legal: {...}, supportEmail, version }`

## Admin (role=admin)
- `GET /admin/metrics` → KPIs (DAU, deposits, points issued, redemption rate, payout pending)
- `GET /admin/deposits.csv?from=&to=` → CSV
- `POST /admin/campaigns` · `PATCH /admin/campaigns/:id`
- `POST /admin/rewards` · `PATCH /admin/rewards/:id`
- `GET /admin/redemptions?status=` · `POST /admin/redemptions/:id/fulfill`
- `POST /admin/machines/:code/box-level` `{ fillPercent }` (drives status/full)
- All admin mutations write `audit_logs` with actor, action, entity, before/after.

## PIX payouts (Phase 2)
Payout fee defaults to **150¢ (R$1,50)**: the user is debited `amountCents` from credit + withdrawable, the provider transfers `netCents = amountCents − feeCents`.

`POST /payouts` (Idempotency-Key) → `{ payout: { id, status: "pending"|"paid"|"failed", amountCents, feeCents, netCents, pixKeyMasked, pixKeyType, provider, providerPayoutId, failureReason, estimatedAt, createdAt, paidAt } }`
Rules: min 2000¢, max 50000¢/request, daily cap 50000¢, only `withdrawableCents`.

`POST /webhooks/pix` (raw body) — verify provider signature/token, dedupe by provider event id, transition `paid` / `failed` (failure refunds exactly once via ledger `payout_refund`).

`GET /payouts` → `{ items }` (user's own history)

## Admin payouts & reconciliation (role=admin)
- `GET /admin/payouts?status=pending|paid|failed|all&cursor=&limit=` → `{ items, nextCursor, totals: { count, amountCents, feeCents, netCents } }`
  - item: `{ id, userName, userPhone, amountCents, feeCents, netCents, pixKeyMasked, status, provider, providerPayoutId, failureReason, createdAt, paidAt }`
- `POST /admin/payouts/:id/paid` `{ note?, providerPayoutId? }` → `{ payout }`
- `POST /admin/payouts/:id/retry` (failed only, optional Idempotency-Key) → `201 { payout }` (new row, `retryOf`)
- `POST /admin/payouts/:id/fail` `{ reason? }` → `{ payout }` (refunds + notifies)
- `GET /admin/reconciliation?from=&to=` → `{ range, counts:{total,pending,paid,failed,refunded}, requestedCents, paidCents, pendingCents, failedCents, refundedCents, feeCents, ledgerPayoutCents, varianceCents, pointsOutstanding, creditOutstandingCents, withdrawableOutstandingCents, balanced, providers[], generatedAt }`
  - Invariant: `varianceCents = ledgerPayoutCents − (paidCents + pendingCents)` must be `0`.

Env: `PIX_PROVIDER=mock|asaas`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `PIX_PAYOUT_FEE_CENTS`, `PIX_MIN_CENTS`, `PIX_DAILY_CAP_CENTS`. Production fails closed if the configured provider has no credentials.

## Health
`GET /health` → `{ ok: true, version, mode: "demo"|"live", stripe: "test"|"unconfigured", uptimeSec }`
