# WANO Rewards — mobile app (Expo SDK 58)

Expo Router + TypeScript app for people who recycle packaging at WANO/RecIO RVMs.
Traditional Chinese (`zh-Hant`, default) and English, switchable at runtime. Light + dark themes.

## Run it

```bash
npm install
cp .env.example .env          # optional: point at a live API
npm start                     # Expo Go / dev client
npm run web                   # browser preview
npm run typecheck             # tsc --noEmit
```

Without `EXPO_PUBLIC_API_URL` the app runs in **demo mode** with an in-memory mock
backend (`src/lib/mock.ts`) so every screen and flow works offline — useful for
design review and store screenshots.

With an API URL the same screens hit the real backend. Do a production-style web
build with:

```bash
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1 npx expo export -p web
```

## Screens

| Route | Screen |
| --- | --- |
| `/welcome`, `/how-it-works`, `/consent` | onboarding + LGPD consent |
| `/sign-in`, `/verify` | passwordless OTP login |
| `/home` | balance, scan CTA, weekly goal, campaigns, ranking, impact, activity |
| `/rewards`, `/reward/[id]` | catalogue, filters, reward detail, redeem confirmation + code |
| `/scan`, `/session/[id]` | QR/manual machine start, live session, receipt |
| `/impact` | lifetime kg/CO₂, 6-month chart, material split, badges |
| `/wallet`, `/checkout`, `/payout` | statement, Stripe test-mode credit top-up, PIX withdrawal |
| `/orders` | vouchers/codes with QR, used/expired tabs, cashier mark-used |
| `/campaign/[id]`, `/leaderboard` | brand/condo campaigns, podium and ranking |
| `/notifications`, `/referral`, `/machines` | inbox, invite programme, nearby RVMs |
| `/profile`, `/settings`, `/privacy`, `/help` | tier progress, preferences, LGPD rights, FAQ |

## Structure

```text
app/                  Expo Router routes (groups: (onboarding), (auth), (tabs))
src/theme/            palette, type scale, spacing, theme provider
src/components/       design-system primitives (Text, Button, Card, Sheet…)
src/lib/api.ts        typed API client + demo/live switch
src/lib/content.ts    localizes seeded API/mock domain content (zh-Hant/en)
src/lib/normalize.ts  adapts backend payloads to UI models
src/lib/mock.ts       stateful mock backend for demo mode
src/lib/hooks.ts      React Query hooks
src/store/            zustand stores (auth, preferences)
src/types.ts          shared domain types
assets/               app icon, splash, favicon, OG image
```

## Design system

- Warm paper background (`#F7F4ED`), forest green (`#0C3B2A`), lime accent.
- Instrument Serif for editorial headlines, Manrope for UI.
- 20px screen gutters, 20–28px radii, hairline borders, near-flat elevation.
- Dark mode uses light mint primary with dark ink; avatars auto-pick contrast.
- All copy goes through `src/lib/i18n.ts` (`zh-Hant` + `en`, `zh-Hant` default);
  `useT()` re-renders on language change.
- `Locale` is `'zh-Hant' | 'en'`; the preference is persisted in `recio.locale` and
  legacy values (e.g. `pt-BR`) are migrated to `zh-Hant` on hydration.
- API/mock domain content is translated by `src/lib/content.ts`, and React Query
  caches are invalidated whenever the locale changes.

## Localization

- Languages: **繁體中文 (zh-Hant, default)** and **English**; switch in
  `/settings` → Language. Labels are static (`繁體中文` / `English`).
- UI chrome: every string lives in the `zh-Hant` / `en` dictionaries in
  `src/lib/i18n.ts` (flat keys, nested by scope). Both dictionaries must keep
  identical key sets.
- Dates and relative time: `src/lib/format.ts` localizes month names
  (`10月` / `Oct`) and `timeAgo` (`5分鐘前` / `5m ago`, `昨天` / `yesterday`).
- Backend content: the API and demo mock return Portuguese seed data (campaigns,
  rewards, machines, notifications, impact badges, tier names, ledger
  descriptions, month labels). `src/lib/content.ts` exposes
  `localizeDeep(value, locale)`, which walks responses and maps known Portuguese
  strings (plus regex rules for dynamic ledger/notification text) to the active
  locale. It is applied once in `src/lib/api.ts` for **both** live and mock
  responses, so screens never render mixed languages. Person names, brands
  (WANO, Danone, Coca-Cola, Padoca do Bairro), addresses, codes and PIX keys are
  intentionally left untouched.

## Backend contract

`docs/api-contract.md` is the source of truth. The app works against the live API
in `apps/api` (see its README), including OTP auth, points/cashback ledger,
campaigns, Stripe test-mode checkout and PIX payouts.

Demo account: `+55 11 99999-0000`, OTP code `123456`.

## Build & store

- `eas.json` defines development / preview / production profiles.
- Set real `bundleIdentifier` / `package` in `app.json` and `EXPO_PUBLIC_API_URL`
  in the EAS profile before building.
- `npx eas build -p android --profile preview` / `-p ios`.
- OTA updates: `npx eas update --branch production`.

## Accessibility & privacy notes

- Minimum touch target 44pt, dynamic type respected by RN, labels on icon buttons.
- Consent captured during onboarding; data export/erasure in `/privacy`.
- No PII in analytics events; recycling history keyed by anonymous IDs on the API.

