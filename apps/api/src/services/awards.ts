/**
 * Award calculation shared by deposit ingestion, simulation and the seed.
 * Points = base × tier multiplier × best campaign multiplier (+ campaign bonus).
 * Cashback is a separate per-item cent value and is NOT multiplied.
 */
import { all } from "../db/index.ts";
import { MATERIALS } from "../config/economy.ts";
import type { CampaignRow, MaterialCode } from "../types.ts";

export interface AwardInput {
  material: MaterialCode;
  weightGrams: number;
  brand?: string | null;
  at: string;
  tierMultiplier: number;
}

export interface AwardResult {
  points: number;
  cashbackCents: number;
  co2Grams: number;
  campaign: CampaignRow | null;
  campaigns: CampaignRow[];
}

/** Campaigns active at `at` matching material + brand targeting. */
export function matchingCampaigns(
  material: MaterialCode,
  brand: string | null | undefined,
  at: string,
): CampaignRow[] {
  const rows = all<CampaignRow>(
    `SELECT * FROM campaigns
     WHERE active = 1 AND starts_at <= ? AND ends_at >= ?
       AND target_unit != 'referrals'
       AND (material IS NULL OR material = ?)
     ORDER BY multiplier DESC, bonus_points DESC`,
    [at, at, material],
  );
  return rows.filter((campaign) => {
    if (!campaign.target_brand) return true;
    return campaign.target_brand.toLowerCase() === (brand ?? "").toLowerCase();
  });
}

export function awardForDeposit(input: AwardInput): AwardResult {
  const spec = MATERIALS[input.material];
  const campaigns = matchingCampaigns(input.material, input.brand, input.at);
  const best = campaigns[0] ?? null;

  const multiplier = (input.tierMultiplier || 1) * (best?.multiplier ?? 1);
  const basePoints = spec.pointsPerItem;
  const points = Math.floor(basePoints * multiplier + 0.5) + (best?.bonus_points ?? 0);
  const co2Grams = Math.round(input.weightGrams * spec.co2GramsPerGram);

  return {
    points,
    cashbackCents: spec.cashbackCentsPerItem,
    co2Grams,
    campaign: best,
    campaigns,
  };
}
