/** Shared domain types (camelCase, API-facing). */

export type Role = "user" | "partner" | "admin";
export type TierCode = "seed" | "sprout" | "forest" | "guardian";
export type MaterialCode = "PET" | "ALUMINUM" | "GLASS" | "HDPE" | "PP" | "PS_HIPS";
export type MachineStatus = "online" | "maintenance" | "full";
export type SessionStatus = "active" | "completed" | "expired";
export type RewardCategory = "voucher" | "product" | "experience" | "donation";
export type RedemptionStatus = "active" | "used" | "expired" | "fulfilled";
export type PaymentStatus =
  | "requires_payment"
  | "paid"
  | "expired"
  | "refunded"
  | "canceled";
export type PaymentProvider = "stripe" | "mock";
export type PayoutStatus = "pending" | "paid" | "failed" | "rejected";

export interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  locale: string;
  avatar_color: string;
  role: Role;
  lifetime_points: number;
  marketing_opt_in: number;
  lgpd_consent_at: string | null;
  lgpd_revoked_at: string | null;
  deleted_at: string | null;
  pseudonymize_after: string | null;
  pseudonymized: number;
  referral_code: string | null;
  referred_by_user_id: string | null;
  condo_id: string | null;
  building_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletRow {
  user_id: string;
  points: number;
  credit_cents: number;
  withdrawable_cents: number;
  updated_at: string;
}

export interface LedgerRow {
  id: string;
  user_id: string;
  points_delta: number;
  credit_delta_cents: number;
  withdrawable_delta_cents: number;
  balance_after_points: number;
  balance_after_credit_cents: number;
  balance_after_withdrawable_cents: number;
  type: string;
  ref_type: string | null;
  ref_id: string | null;
  description: string;
  created_at: string;
  idempotency_key: string | null;
}

export interface CondoRow {
  id: string;
  name: string;
  city: string;
  state: string;
  neighborhood: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface BuildingRow {
  id: string;
  condo_id: string;
  name: string;
  address: string;
  created_at: string;
}

export interface MachineRow {
  id: string;
  code: string;
  name: string;
  condo_id: string | null;
  building_id: string | null;
  address: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  status: MachineStatus;
  fill_percent: number;
  hours: string;
  api_key: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  machine_id: string;
  status: SessionStatus;
  source: string;
  token: string;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  items: number;
  weight_grams: number;
  points_earned: number;
  cashback_cents: number;
  co2_grams: number;
  receipt_json: string | null;
  created_at: string;
}

export interface DepositRow {
  id: string;
  session_id: string;
  user_id: string;
  machine_id: string;
  gtin: string | null;
  material: MaterialCode;
  sku_name: string | null;
  weight_grams: number;
  accepted: number;
  reject_reason: string | null;
  points: number;
  cashback_cents: number;
  co2_grams: number;
  batch_id: string | null;
  event_id: string | null;
  campaign_id: string | null;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  target_brand: string | null;
  subtitle: string | null;
  material: MaterialCode | null;
  multiplier: number;
  bonus_points: number;
  starts_at: string;
  ends_at: string;
  image_key: string;
  accent: string;
  target_value: number | null;
  baseline_value: number;
  target_unit: string;
  scope: string;
  condo_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface RewardRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: RewardCategory;
  partner: string;
  points_cost: number;
  value_cents: number;
  image_key: string;
  stock: number;
  is_new: number;
  highlight: number;
  terms: string;
  expires_at: string | null;
  requires_delivery: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface RedemptionRow {
  id: string;
  code: string;
  user_id: string;
  reward_id: string;
  quantity: number;
  points_spent: number;
  value_cents: number;
  status: RedemptionStatus;
  qr_payload: string;
  delivery_json: string | null;
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
  fulfilled_at: string | null;
}

export interface PaymentRow {
  id: string;
  user_id: string;
  kind: "topup" | "mini_market";
  pack_id: string | null;
  status: PaymentStatus;
  provider: PaymentProvider;
  amount_cents: number;
  credit_cents: number;
  bonus_points: number;
  currency: string;
  checkout_url: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  code: string | null;
  machine_id: string | null;
  metadata_json: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface PayoutRow {
  id: string;
  user_id: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  pix_key: string;
  pix_key_type: string;
  pix_key_masked: string;
  status: PayoutStatus;
  provider: string;
  provider_payout_id: string | null;
  failure_reason: string | null;
  retry_of: string | null;
  estimated_at: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  admin_note: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  icon: string | null;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface LeaderboardRow {
  position: number;
  displayName: string;
  avatarColor: string;
  value: number;
  unit: string;
  isMe: boolean;
}

export interface CampaignView {
  id: string;
  title: string;
  brand: string | null;
  subtitle: string | null;
  material: MaterialCode | null;
  multiplier: number;
  bonusPoints: number;
  startsAt: string;
  endsAt: string;
  imageKey: string;
  accent: string;
  progress: { current: number; target: number; unit: string } | null;
  joined: boolean;
}
