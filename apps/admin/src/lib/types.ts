export interface Metrics {
  users: number;
  depositsTotal: number;
  pointsIssued: number;
  redemptionRate: number;
  payoutPendingCents: number;
  kgTotal: number;
  co2SavedKg: number;
  machines: { online: number; maintenance: number; full: number };
  activeCampaigns: number;
  activeRewards: number;
  depositsByDay: Array<{ date: string; count: number; kg: number }>;
}

export type PayoutStatus = 'pending' | 'paid' | 'failed';

export interface Payout {
  id: string;
  userName: string;
  userPhone: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  pixKeyMasked: string;
  status: PayoutStatus;
  provider: string;
  providerPayoutId: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface PayoutTotals {
  pendingCents: number;
  paidCents: number;
  failedCents: number;
  count: number;
}

export interface PayoutsResponse {
  items: Payout[];
  totals: PayoutTotals;
}

export interface Redemption {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired' | 'fulfilled';
  userName: string;
  userPhone: string;
  rewardTitle: string;
  rewardPartner: string;
  pointsSpent: number;
  createdAt: string;
  expiresAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  brand: string;
  subtitle: string;
  material: string | null;
  multiplier: number;
  bonusPoints: number;
  startsAt: string;
  endsAt: string;
  imageKey: string;
  accent: string;
  active?: boolean;
}

export interface Reward {
  id: string;
  title: string;
  subtitle: string;
  category: 'voucher' | 'product' | 'experience' | 'donation';
  partner: string;
  pointsCost: number;
  valueCents: number;
  imageKey: string;
  stock: number;
  active?: boolean;
  terms: string;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  address: string;
  distanceMeters: number;
  status: 'online' | 'maintenance' | 'full';
  materials: string[];
  fillPercent: number;
  hours: string;
}

export interface DepositRow {
  id: string;
  createdAt: string;
  userName: string;
  machineCode: string;
  material: string;
  skuName: string;
  weightGrams: number;
  accepted: boolean;
  rejectReason: string | null;
  points: number;
  cashbackCents: number;
}

export interface Reconciliation {
  generatedAt: string;
  range: { from: string; to: string };
  counts: { requested: number; paid: number; pending: number; failed: number };
  requestedCents: number;
  paidCents: number;
  pendingCents: number;
  failedCents: number;
  refundedCents: number;
  feeCents: number;
  ledgerPayoutCents: number;
  varianceCents: number;
  balanced: boolean;
  liabilities: {
    pointsOutstanding: number;
    creditOutstandingCents: number;
    withdrawableOutstandingCents: number;
    balanced: boolean;
  };
  providers: Array<{ provider: string; count: number; amountCents: number }>;
}
