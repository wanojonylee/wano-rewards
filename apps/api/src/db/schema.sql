-- RecIO Rewards — SQLite schema (v1)
-- Money: integer cents (BRL). Points: integers. Timestamps: ISO-8601 UTC text.
-- Applied idempotently on boot (src/db/index.ts).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Locations & hardware
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS condos (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  neighborhood  TEXT NOT NULL,
  address       TEXT NOT NULL,
  latitude      REAL NOT NULL,
  longitude     REAL NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  id          TEXT PRIMARY KEY,
  condo_id    TEXT NOT NULL REFERENCES condos(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machines (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  condo_id        TEXT REFERENCES condos(id) ON DELETE SET NULL,
  building_id     TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  address         TEXT NOT NULL,
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  distance_meters INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','maintenance','full')),
  fill_percent    INTEGER NOT NULL DEFAULT 0 CHECK (fill_percent BETWEEN 0 AND 100),
  hours           TEXT NOT NULL DEFAULT '24h',
  api_key         TEXT NOT NULL UNIQUE,
  last_seen_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machine_materials (
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  material   TEXT NOT NULL,
  PRIMARY KEY (machine_id, material)
);

-- ---------------------------------------------------------------------------
-- Identity & consent (LGPD)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  name               TEXT,
  email              TEXT,
  phone              TEXT UNIQUE,
  locale             TEXT NOT NULL DEFAULT 'pt-BR',
  avatar_color       TEXT NOT NULL DEFAULT '#16A34A',
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','partner','admin')),
  lifetime_points    INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  marketing_opt_in   INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0,1)),
  lgpd_consent_at    TEXT,
  lgpd_revoked_at    TEXT,
  deleted_at         TEXT,
  pseudonymize_after TEXT,
  pseudonymized      INTEGER NOT NULL DEFAULT 0 CHECK (pseudonymized IN (0,1)),
  referral_code      TEXT UNIQUE,
  referred_by_user_id TEXT,
  condo_id           TEXT REFERENCES condos(id) ON DELETE SET NULL,
  building_id        TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points            INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  credit_cents      INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  withdrawable_cents INTEGER NOT NULL DEFAULT 0 CHECK (withdrawable_cents >= 0 AND withdrawable_cents <= credit_cents),
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'sms',
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  request_ip  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT,
  replaced_by_id TEXT,
  user_agent    TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Recycling sessions & deposits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id    TEXT NOT NULL REFERENCES machines(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired')),
  source        TEXT NOT NULL DEFAULT 'qr',
  token         TEXT NOT NULL UNIQUE,
  started_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  completed_at  TEXT,
  items         INTEGER NOT NULL DEFAULT 0,
  weight_grams  INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  cashback_cents INTEGER NOT NULL DEFAULT 0,
  co2_grams     INTEGER NOT NULL DEFAULT 0,
  receipt_json  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deposits (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id     TEXT NOT NULL REFERENCES machines(id),
  gtin           TEXT,
  material       TEXT NOT NULL,
  sku_name       TEXT,
  weight_grams   INTEGER NOT NULL,
  accepted       INTEGER NOT NULL CHECK (accepted IN (0,1)),
  reject_reason  TEXT,
  points         INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  cashback_cents INTEGER NOT NULL DEFAULT 0 CHECK (cashback_cents >= 0),
  co2_grams      INTEGER NOT NULL DEFAULT 0,
  batch_id       TEXT,
  event_id       TEXT,
  campaign_id    TEXT,
  created_at     TEXT NOT NULL
);

-- Attribution: a deposit can count toward several campaigns (progress/ranking),
-- while `deposits.campaign_id` keeps the campaign that paid the best multiplier.
CREATE TABLE IF NOT EXISTS deposit_campaigns (
  deposit_id  TEXT NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  PRIMARY KEY (deposit_id, campaign_id)
);

-- ---------------------------------------------------------------------------
-- Campaigns & rewards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  brand        TEXT,
  target_brand TEXT,
  subtitle     TEXT,
  material     TEXT,
  multiplier   REAL NOT NULL DEFAULT 1,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  image_key    TEXT NOT NULL,
  accent       TEXT NOT NULL DEFAULT '#10B981',
  target_value REAL,
  baseline_value REAL NOT NULL DEFAULT 0,
  target_unit  TEXT NOT NULL DEFAULT 'items',
  scope        TEXT NOT NULL DEFAULT 'national',
  condo_id     TEXT REFERENCES condos(id) ON DELETE SET NULL,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_participants (  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TEXT NOT NULL,
  items       INTEGER NOT NULL DEFAULT 0,
  weight_grams INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS rewards (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  subtitle        TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('voucher','product','experience','donation')),
  partner         TEXT NOT NULL,
  points_cost     INTEGER NOT NULL CHECK (points_cost > 0),
  value_cents     INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  image_key       TEXT NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_new          INTEGER NOT NULL DEFAULT 0 CHECK (is_new IN (0,1)),
  highlight       INTEGER NOT NULL DEFAULT 0 CHECK (highlight IN (0,1)),
  terms           TEXT NOT NULL DEFAULT '',
  expires_at      TEXT,
  requires_delivery INTEGER NOT NULL DEFAULT 0 CHECK (requires_delivery IN (0,1)),
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id     TEXT NOT NULL REFERENCES rewards(id),
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  points_spent  INTEGER NOT NULL CHECK (points_spent >= 0),
  value_cents   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','fulfilled')),
  qr_payload    TEXT NOT NULL,
  delivery_json TEXT,
  expires_at    TEXT,
  created_at    TEXT NOT NULL,
  used_at       TEXT,
  fulfilled_at  TEXT
);

-- ---------------------------------------------------------------------------
-- Money movement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                    TEXT NOT NULL DEFAULT 'topup' CHECK (kind IN ('topup','mini_market')),
  pack_id                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'requires_payment',
  provider                TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('stripe','mock')),
  amount_cents            INTEGER NOT NULL CHECK (amount_cents >= 0),
  credit_cents            INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  bonus_points            INTEGER NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'BRL',
  checkout_url            TEXT,
  stripe_session_id       TEXT,
  stripe_payment_intent_id TEXT,
  code                    TEXT,
  machine_id              TEXT REFERENCES machines(id) ON DELETE SET NULL,
  metadata_json           TEXT,
  created_at              TEXT NOT NULL,
  completed_at            TEXT,
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  fee_cents      INTEGER NOT NULL DEFAULT 0,
  net_cents      INTEGER NOT NULL,
  pix_key        TEXT NOT NULL,
  pix_key_type   TEXT NOT NULL,
  pix_key_masked TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','rejected')),
  provider       TEXT NOT NULL DEFAULT 'mock',
  provider_payout_id TEXT,
  failure_reason TEXT,
  retry_of       TEXT,
  estimated_at   TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  paid_at        TEXT,
  refunded_at    TEXT,
  admin_note     TEXT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_delta                INTEGER NOT NULL DEFAULT 0,
  credit_delta_cents          INTEGER NOT NULL DEFAULT 0,
  withdrawable_delta_cents    INTEGER NOT NULL DEFAULT 0,
  balance_after_points        INTEGER NOT NULL,
  balance_after_credit_cents  INTEGER NOT NULL,
  balance_after_withdrawable_cents INTEGER NOT NULL,
  type                        TEXT NOT NULL,
  ref_type                    TEXT,
  ref_id                      TEXT,
  description                 TEXT NOT NULL,
  idempotency_key             TEXT,
  created_at                  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  icon       TEXT,
  deep_link  TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id                TEXT PRIMARY KEY,
  referrer_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id  TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'applied',
  bonus_points      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  applied_at        TEXT
);

-- ---------------------------------------------------------------------------
-- Operations & compliance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id            TEXT PRIMARY KEY,
  key           TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  request_hash  TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status_code   INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  UNIQUE (user_id, endpoint, key)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  type         TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_json TEXT,
  status       TEXT NOT NULL DEFAULT 'processed',
  processed_at TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_active_per_user
  ON sessions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_deposits_session ON deposits(session_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user_created ON deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_machine_created ON deposits(machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_gtin ON deposits(gtin);
CREATE INDEX IF NOT EXISTS idx_deposits_created ON deposits(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_event ON deposits(event_id);

CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(ref_type, ref_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency
  ON ledger_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_condo ON users(condo_id);
CREATE INDEX IF NOT EXISTS idx_users_building ON users(building_id);
CREATE INDEX IF NOT EXISTS idx_users_lifetime ON users(lifetime_points DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(category, points_cost);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(active, highlight DESC);

CREATE INDEX IF NOT EXISTS idx_redemptions_user_created ON redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status);

CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payouts_user_created ON payouts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_window ON campaigns(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_deposit_campaigns_campaign ON deposit_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_user ON campaign_participants(user_id);
