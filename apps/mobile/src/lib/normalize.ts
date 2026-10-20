import type {
  Campaign,
  HomeData,
  ImpactData,
  Leaderboard,
  LedgerEntry,
  Profile,
  Redemption,
  Reward,
  Tier,
} from '../types';

type Raw = Record<string, any>;

const DEFAULT_TIER: Tier = {
  code: 'seed',
  name: 'Seed',
  minPoints: 0,
  nextTier: null,
  pointsToNext: 0,
  multiplier: 1,
  perks: [],
};

/** API returns nextTier as an object; the UI wants its display name. */
export function normalizeTier(raw: Raw | null | undefined): Tier {
  if (!raw) return DEFAULT_TIER;
  const next = raw.nextTier;
  const nextName = typeof next === 'string' ? next : next?.name ?? null;
  const nextMin = typeof next === 'object' && next ? Number(next.minPoints) : undefined;
  return {
    code: raw.code ?? 'seed',
    name: raw.name ?? 'Seed',
    minPoints: Number(raw.minPoints ?? 0),
    nextTier: nextName,
    pointsToNext: Number(raw.pointsToNext ?? 0),
    multiplier: Number(raw.multiplier ?? 1),
    perks: Array.isArray(raw.perks) ? raw.perks : [],
    nextTierMinPoints: Number.isFinite(nextMin) ? nextMin : undefined,
  };
}

export function normalizeLedger(raw: Raw): LedgerEntry {
  return {
    id: String(raw.id ?? ''),
    type: raw.type ?? 'adjust',
    pointsDelta: Number(raw.pointsDelta ?? raw.points_delta ?? 0),
    creditDeltaCents: Number(raw.creditDeltaCents ?? raw.credit_delta_cents ?? 0),
    balanceAfterPoints: Number(raw.balanceAfterPoints ?? raw.balance_after_points ?? 0),
    balanceAfterCreditCents: Number(raw.balanceAfterCreditCents ?? raw.balance_after_credit_cents ?? 0),
    description: String(raw.description ?? ''),
    refType: raw.refType ?? raw.ref_type ?? null,
    refId: raw.refId ?? raw.ref_id ?? null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
  };
}

export function normalizeCampaign(raw: Raw): Campaign {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    brand: String(raw.brand ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    material: raw.material ?? 'MIXED',
    multiplier: Number(raw.multiplier ?? 1),
    bonusPoints: Number(raw.bonusPoints ?? 0),
    startsAt: String(raw.startsAt ?? new Date().toISOString()),
    endsAt: String(raw.endsAt ?? new Date().toISOString()),
    imageKey: String(raw.imageKey ?? 'bottle'),
    accent: String(raw.accent ?? '#3E8E7E'),
    progress: raw.progress
      ? { current: Number(raw.progress.current ?? 0), target: Number(raw.progress.target ?? 1), unit: String(raw.progress.unit ?? 'kg') }
      : null,
    joined: Boolean(raw.joined),
  };
}

export function normalizeReward(raw: Raw): Reward {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    category: raw.category ?? 'voucher',
    partner: String(raw.partner ?? ''),
    pointsCost: Number(raw.pointsCost ?? raw.points_cost ?? 0),
    valueCents: Number(raw.valueCents ?? raw.value_cents ?? 0),
    imageKey: String(raw.imageKey ?? raw.image_key ?? 'gift'),
    stock: Number(raw.stock ?? 0),
    stockLabel: raw.stockLabel ?? raw.stock_label ?? null,
    isNew: Boolean(raw.isNew ?? raw.is_new),
    highlight: Boolean(raw.highlight),
    terms: String(raw.terms ?? ''),
    expiresAt: raw.expiresAt ?? raw.expires_at ?? null,
  };
}

export function normalizeRedemption(raw: Raw): Redemption {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    qrPayload: String(raw.qrPayload ?? raw.qr_payload ?? ''),
    status: raw.status ?? 'active',
    expiresAt: String(raw.expiresAt ?? raw.expires_at ?? new Date().toISOString()),
    reward: {
      ...normalizeReward(raw.reward ?? {}),
      pointsCost: Number(raw.pointsSpent ?? raw.reward?.pointsCost ?? 0),
      expiresAt: raw.reward?.expiresAt ?? null,
    },
    pointsSpent: Number(raw.pointsSpent ?? raw.points_spent ?? 0),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
  };
}

export function normalizeProfile(raw: Raw): Profile {
  return {
    user: {
      id: String(raw.user?.id ?? ''),
      name: String(raw.user?.name ?? 'Reciclador'),
      email: raw.user?.email ?? null,
      phone: String(raw.user?.phone ?? ''),
      locale: raw.user?.locale === 'en' ? 'en' : 'zh-Hant',
      avatarColor: String(raw.user?.avatarColor ?? '#0C3B2A'),
      memberSince: String(raw.user?.memberSince ?? new Date().toISOString()),
      consent: {
        lgpdAt: raw.user?.consent?.lgpdAt ?? null,
        marketingOptIn: Boolean(raw.user?.consent?.marketingOptIn),
      },
    },
    wallet: {
      points: Number(raw.wallet?.points ?? 0),
      creditCents: Number(raw.wallet?.creditCents ?? 0),
      withdrawableCents: Number(raw.wallet?.withdrawableCents ?? 0),
      expiring: raw.wallet?.expiring ?? null,
    },
    tier: normalizeTier(raw.tier),
    stats: {
      kgTotal: Number(raw.stats?.kgTotal ?? 0),
      itemsTotal: Number(raw.stats?.itemsTotal ?? 0),
      co2SavedKg: Number(raw.stats?.co2SavedKg ?? 0),
      sessionsTotal: Number(raw.stats?.sessionsTotal ?? 0),
      currentStreakWeeks: Number(raw.stats?.currentStreakWeeks ?? 0),
    },
    rank: {
      condo: {
        position: Number(raw.rank?.condo?.position ?? 0),
        total: Number(raw.rank?.condo?.total ?? 0),
        percentile: Number(raw.rank?.condo?.percentile ?? 0),
      },
      building: {
        position: Number(raw.rank?.building?.position ?? 0),
        total: Number(raw.rank?.building?.total ?? 0),
      },
    },
  };
}

export function normalizeHome(raw: Raw): HomeData {
  const goal = raw.weeklyGoal ?? {};
  return {
    wallet: {
      points: Number(raw.wallet?.points ?? 0),
      creditCents: Number(raw.wallet?.creditCents ?? 0),
      withdrawableCents: Number(raw.wallet?.withdrawableCents ?? 0),
      expiring: raw.wallet?.expiring ?? null,
    },
    tier: normalizeTier(raw.tier),
    stats: {
      kgTotal: Number(raw.stats?.kgTotal ?? 0),
      itemsTotal: Number(raw.stats?.itemsTotal ?? 0),
      co2SavedKg: Number(raw.stats?.co2SavedKg ?? 0),
      sessionsTotal: Number(raw.stats?.sessionsTotal ?? 0),
      currentStreakWeeks: Number(raw.stats?.currentStreakWeeks ?? 0),
    },
    rank: {
      condo: {
        position: Number(raw.rank?.condo?.position ?? 0),
        total: Number(raw.rank?.condo?.total ?? 0),
        percentile: Number(raw.rank?.condo?.percentile ?? 0),
      },
      building: {
        position: Number(raw.rank?.building?.position ?? 0),
        total: Number(raw.rank?.building?.total ?? 0),
      },
    },
    campaigns: Array.isArray(raw.campaigns) ? raw.campaigns.map(normalizeCampaign) : [],
    recent: Array.isArray(raw.recent) ? raw.recent.map(normalizeLedger) : [],
    nearbyMachine: raw.nearbyMachine ?? null,
    weeklyGoal: {
      current: Number(goal.currentItems ?? goal.current ?? 0),
      target: Number(goal.targetItems ?? goal.target ?? 20),
    },
    greetingName: String(raw.greetingName ?? 'Reciclador'),
  };
}

export function normalizeLeaderboard(raw: Raw): Leaderboard {
  const period = typeof raw.period === 'string' ? raw.period : raw.period?.label ?? 'Este mês';
  return {
    scope: raw.scope ?? 'condo',
    period,
    rows: Array.isArray(raw.rows)
      ? raw.rows.map((row: Raw) => ({
          position: Number(row.position ?? 0),
          displayName: String(row.displayName ?? ''),
          avatarColor: String(row.avatarColor ?? '#0C3B2A'),
          value: Number(row.value ?? 0),
          unit: String(row.unit ?? 'kg'),
          isMe: Boolean(row.isMe),
        }))
      : [],
    me: raw.me
      ? {
          position: Number(raw.me.position ?? 0),
          displayName: String(raw.me.displayName ?? ''),
          avatarColor: String(raw.me.avatarColor ?? '#0C3B2A'),
          value: Number(raw.me.value ?? 0),
          unit: String(raw.me.unit ?? 'kg'),
          isMe: Boolean(raw.me.isMe),
        }
      : null,
  };
}

export function normalizeImpact(raw: Raw): ImpactData {
  return {
    months: Array.isArray(raw.months) ? raw.months.map((m: Raw) => ({ label: String(m.label ?? ''), kg: Number(m.kg ?? 0) })) : [],
    materials: Array.isArray(raw.materials) ? raw.materials.map((m: Raw) => ({ material: m.material, kg: Number(m.kg ?? 0) })) : [],
    totals: {
      kg: Number(raw.totals?.kg ?? 0),
      co2Kg: Number(raw.totals?.co2Kg ?? 0),
      items: Number(raw.totals?.items ?? 0),
      sessions: Number(raw.totals?.sessions ?? 0),
    },
    badges: Array.isArray(raw.badges)
      ? raw.badges.map((b: Raw) => ({
          id: String(b.id ?? ''),
          title: String(b.title ?? ''),
          description: String(b.description ?? ''),
          unlocked: Boolean(b.unlocked),
          progress: b.progress ? { current: Number(b.progress.current ?? 0), target: Number(b.progress.target ?? 1) } : null,
        }))
      : [],
  };
}
