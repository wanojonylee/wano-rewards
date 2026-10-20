/**
 * Server-authoritative economy configuration.
 *
 * CASHBACK / POINTS ARE EXPRESSED IN INTEGER CENTS AND INTEGER POINTS.
 * Per-item values are approximations used by the RVM: 28 g for a PET bottle,
 * 15 g for an aluminium can. CO2 factors are documented approximations:
 *   - plastics (PET/HDPE/PP/PS): 1.5 g CO2e per gram of material
 *   - aluminium: 9.1 g CO2e per gram (virgin aluminium is very carbon intensive)
 *   - glass: 0.5 g CO2e per gram (approx., reuse/recycling mix)
 */
import { env } from "../env.ts";
import type { MaterialCode, TierCode } from "../types.ts";

export interface MaterialSpec {
  code: MaterialCode;
  name: string;
  shortName: string;
  pointsPerItem: number;
  cashbackCentsPerItem: number;
  approxWeightGrams: number;
  co2GramsPerGram: number;
  color: string;
}

export const MATERIALS: Record<MaterialCode, MaterialSpec> = {
  PET: {
    code: "PET",
    name: "Garrafa PET",
    shortName: "PET",
    pointsPerItem: 10,
    cashbackCentsPerItem: 5,
    approxWeightGrams: 28,
    co2GramsPerGram: 1.5,
    color: "#2E86DE",
  },
  ALUMINUM: {
    code: "ALUMINUM",
    name: "Lata de alumínio",
    shortName: "Alumínio",
    pointsPerItem: 15,
    cashbackCentsPerItem: 8,
    approxWeightGrams: 15,
    co2GramsPerGram: 9.1,
    color: "#C0392B",
  },
  GLASS: {
    code: "GLASS",
    name: "Vidro",
    shortName: "Vidro",
    pointsPerItem: 6,
    cashbackCentsPerItem: 3,
    approxWeightGrams: 300,
    co2GramsPerGram: 0.5,
    color: "#16A085",
  },
  HDPE: {
    code: "HDPE",
    name: "Plástico HDPE",
    shortName: "HDPE",
    pointsPerItem: 12,
    cashbackCentsPerItem: 6,
    approxWeightGrams: 30,
    co2GramsPerGram: 1.5,
    color: "#8E44AD",
  },
  PP: {
    code: "PP",
    name: "Plástico PP",
    shortName: "PP",
    pointsPerItem: 8,
    cashbackCentsPerItem: 4,
    approxWeightGrams: 25,
    co2GramsPerGram: 1.5,
    color: "#D35400",
  },
  PS_HIPS: {
    code: "PS_HIPS",
    name: "Poliestireno (PS/HIPS)",
    shortName: "PS/HIPS",
    pointsPerItem: 6,
    cashbackCentsPerItem: 3,
    approxWeightGrams: 20,
    co2GramsPerGram: 1.5,
    color: "#7F8C8D",
  },
};

export const MATERIAL_CODES = Object.keys(MATERIALS) as MaterialCode[];

export interface TierSpec {
  code: TierCode;
  name: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
  color: string;
}

export const TIERS: TierSpec[] = [
  {
    code: "seed",
    name: "Semente",
    minPoints: 0,
    multiplier: 1,
    perks: ["Cashback padrão", "Acesso a todas as máquinas"],
    color: "#94A3B8",
  },
  {
    code: "sprout",
    name: "Broto",
    minPoints: 500,
    multiplier: 1.05,
    perks: ["+5% de pontos em cada reciclagem", "Sorteios mensais"],
    color: "#34D399",
  },
  {
    code: "forest",
    name: "Floresta",
    minPoints: 2000,
    multiplier: 1.1,
    perks: [
      "+10% de pontos em cada reciclagem",
      "Recompensas exclusivas",
      "Prioridade em campanhas",
    ],
    color: "#10B981",
  },
  {
    code: "guardian",
    name: "Guardião",
    minPoints: 5000,
    multiplier: 1.2,
    perks: [
      "+20% de pontos em cada reciclagem",
      "Recompensas exclusivas",
      "Convites para eventos RecIO",
      "Suporte prioritário",
    ],
    color: "#047857",
  },
];

export interface TierView {
  code: TierCode;
  name: string;
  minPoints: number;
  nextTier: { code: TierCode; name: string; minPoints: number } | null;
  pointsToNext: number;
  multiplier: number;
  perks: string[];
}

/** Tier is derived from lifetime points (never from current balance). */
export function tierFor(lifetimePoints: number): TierView {
  const points = Math.max(0, Math.trunc(lifetimePoints));
  let index = 0;
  for (let i = 0; i < TIERS.length; i += 1) {
    const tier = TIERS[i];
    if (tier && points >= tier.minPoints) index = i;
  }
  const current = TIERS[index] as TierSpec;
  const next = TIERS[index + 1] ?? null;
  return {
    code: current.code,
    name: current.name,
    minPoints: current.minPoints,
    nextTier: next ? { code: next.code, name: next.name, minPoints: next.minPoints } : null,
    pointsToNext: next ? Math.max(0, next.minPoints - points) : 0,
    multiplier: current.multiplier,
    perks: current.perks,
  };
}

/** Points only are multiplied; round half up as required by the contract. */
export function applyMultiplier(points: number, multiplier: number): number {
  return Math.floor(points * multiplier + 0.5);
}

export interface PackSpec {
  id: string;
  creditCents: number;
  bonusPoints: number;
  priceCents: number;
  currency: "BRL";
  label: string;
  badge: string | null;
}

/** Server-authoritative top-up packs. Client-sent prices are never trusted. */
export const PACKS: PackSpec[] = [
  {
    id: "pack-20",
    creditCents: 2000,
    bonusPoints: 50,
    priceCents: 2000,
    currency: "BRL",
    label: "R$ 20",
    badge: null,
  },
  {
    id: "pack-50",
    creditCents: 5000,
    bonusPoints: 150,
    priceCents: 5000,
    currency: "BRL",
    label: "R$ 50",
    badge: "Mais popular",
  },
  {
    id: "pack-100",
    creditCents: 10000,
    bonusPoints: 400,
    priceCents: 10000,
    currency: "BRL",
    label: "R$ 100",
    badge: "Melhor valor",
  },
];

export function findPack(packId: string): PackSpec | undefined {
  return PACKS.find((pack) => pack.id === packId);
}

export const RULES = Object.freeze({
  sessionTtlMinutes: 10,
  maxItemsPerSession: 500,
  maxWeightGrams: 3000,
  duplicateGtinWindowMs: 5_000,
  weeklyGoalItems: 20,
  weeklyGoalBonusPoints: 50,
  // PIX payout rules come from env so operations can tune them without a
  // deploy (fees are charged to the user on top of the requested amount).
  payoutMinCents: env.pixMinCents,
  payoutMaxPerRequestCents: 50_000,
  payoutDailyCapCents: env.pixDailyCapCents,
  payoutFeeCents: env.pixPayoutFeeCents,
  referralRewardPoints: 500,
  refereeBonusPoints: 250,
  pointsExpiryDays: null,
  depositBatchPrefix: "LOTE",
});

/** Points per kg, derived from per-item points and approximate weights. */
export function pointsPerKg(): Record<MaterialCode, number> {
  const out = {} as Record<MaterialCode, number>;
  for (const material of MATERIAL_CODES) {
    const spec = MATERIALS[material];
    out[material] = Math.round((spec.pointsPerItem / spec.approxWeightGrams) * 1000);
  }
  return out;
}
