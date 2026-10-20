export type Locale = 'zh-Hant' | 'en';
export type Material = 'PET' | 'ALUMINUM' | 'GLASS' | 'HDPE' | 'PP' | 'PS_HIPS';
export type RewardCategory = 'voucher' | 'product' | 'experience' | 'donation';
export type TierCode = 'seed' | 'sprout' | 'forest' | 'guardian';

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  locale: Locale;
  avatarColor: string;
  memberSince: string;
  consent: { lgpdAt: string | null; marketingOptIn: boolean };
}

export interface Wallet {
  points: number;
  creditCents: number;
  withdrawableCents: number;
  expiring: { points: number; at: string } | null;
}

export interface Tier {
  code: TierCode;
  name: string;
  minPoints: number;
  nextTier: string | null;
  pointsToNext: number;
  multiplier: number;
  perks: string[];
  nextTierMinPoints?: number;
}

export interface RankPosition {
  position: number;
  total: number;
  percentile?: number;
}

export interface UserStats {
  kgTotal: number;
  itemsTotal: number;
  co2SavedKg: number;
  sessionsTotal: number;
  currentStreakWeeks: number;
}

export interface Profile {
  user: User;
  wallet: Wallet;
  tier: Tier;
  stats: UserStats;
  rank: { condo: RankPosition; building: RankPosition };
}

export interface LedgerEntry {
  id: string;
  type: 'earn' | 'redeem' | 'payout' | 'topup' | 'bonus' | 'expire' | 'referral' | 'adjust' | 'mini_market';
  pointsDelta: number;
  creditDeltaCents: number;
  balanceAfterPoints: number;
  balanceAfterCreditCents: number;
  description: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  brand: string;
  subtitle: string;
  material: Material | 'MIXED';
  multiplier: number;
  bonusPoints: number;
  startsAt: string;
  endsAt: string;
  imageKey: string;
  accent: string;
  progress: { current: number; target: number; unit: string } | null;
  joined: boolean;
}

export interface Reward {
  id: string;
  title: string;
  subtitle: string;
  category: RewardCategory;
  partner: string;
  pointsCost: number;
  valueCents: number;
  imageKey: string;
  stock: number;
  stockLabel: string | null;
  isNew: boolean;
  highlight: boolean;
  terms: string;
  expiresAt: string | null;
}

export interface Redemption {
  id: string;
  code: string;
  qrPayload: string;
  status: 'active' | 'used' | 'expired';
  expiresAt: string;
  reward: Reward;
  pointsSpent: number;
  createdAt: string;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  address: string;
  distanceMeters: number;
  status: 'online' | 'maintenance' | 'full';
  materials: Material[];
  fillPercent: number;
  hours: string;
}

export interface Deposit {
  id: string;
  material: Material;
  skuName: string;
  weightGrams: number;
  points: number;
  cashbackCents: number;
  accepted: boolean;
  rejectReason: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  status: 'active' | 'completed' | 'expired';
  machine: Machine;
  startedAt: string;
  expiresAt: string;
  deposits: Deposit[];
  totals: {
    items: number;
    weightGrams: number;
    points: number;
    cashbackCents: number;
    co2Grams: number;
  };
  receipt: {
    items: number;
    points: number;
    cashbackCents: number;
    co2Grams: number;
    completedAt: string;
  } | null;
}

export interface HomeData {
  wallet: Wallet;
  tier: Tier;
  stats: UserStats;
  rank: { condo: RankPosition; building: RankPosition };
  campaigns: Campaign[];
  recent: LedgerEntry[];
  nearbyMachine: Machine | null;
  weeklyGoal: { current: number; target: number };
  greetingName: string;
}

export interface Pack {
  id: string;
  creditCents: number;
  bonusPoints: number;
  priceCents: number;
  currency: 'BRL';
  label: string;
  badge: string | null;
}

export interface Payment {
  id: string;
  status: 'requires_payment' | 'processing' | 'paid' | 'failed' | 'expired';
  provider: 'stripe' | 'mock';
  checkoutUrl: string | null;
  amountCents: number;
  creditCents: number;
  bonusPoints: number;
  createdAt: string;
}

export interface Payout {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  amountCents: number;
  feeCents: number;
  netCents: number;
  pixKeyMasked: string;
  estimatedAt: string;
  createdAt: string;
}

export interface LeaderboardRow {
  position: number;
  displayName: string;
  avatarColor: string;
  value: number;
  unit: string;
  isMe: boolean;
}

export interface Leaderboard {
  scope: 'condo' | 'building' | 'city';
  period: string;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: 'reward' | 'campaign' | 'machine' | 'payout' | 'system';
  read: boolean;
  createdAt: string;
  deepLink: string | null;
}

export interface Referral {
  code: string;
  link: string;
  invited: number;
  earnedPoints: number;
  rewardPerFriend: number;
  rules: string[];
}

export interface Config {
  currency: 'BRL';
  locale: Locale;
  locales: Locale[];
  pointsPerKg: Record<Material, number>;
  materials: Material[];
  legal: { privacyUrl: string; termsUrl: string; supportEmail: string };
  supportEmail: string;
  version: string;
}

export interface ImpactBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
}

export interface ImpactData {
  months: Array<{ label: string; kg: number }>;
  materials: Array<{ material: Material; kg: number }>;
  totals: { kg: number; co2Kg: number; items: number; sessions: number };
  badges: ImpactBadge[];
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: User;
}

export interface OtpRequestResult {
  sent: boolean;
  devCode?: string;
  expiresIn: number;
}
