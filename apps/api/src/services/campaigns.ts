/** Campaign presentation, progress, membership and leaderboard wiring. */
import { all, get, run } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { nowIso } from "../utils/time.ts";
import { buildLeaderboard, type LeaderboardView } from "./leaderboard.ts";
import type { CampaignRow, CampaignView, UserRow } from "../types.ts";

export function campaignRow(idOrSlug: string): CampaignRow | undefined {
  return get<CampaignRow>(
    "SELECT * FROM campaigns WHERE (id = ? OR slug = ?) AND active = 1",
    [idOrSlug, idOrSlug],
  );
}

export function requireCampaign(idOrSlug: string): CampaignRow {
  const campaign = campaignRow(idOrSlug);
  if (!campaign) throw ApiError.notFound("Campanha não encontrada");
  return campaign;
}

function progressFor(campaign: CampaignRow): { current: number; target: number; unit: string } | null {
  if (campaign.target_value == null || campaign.target_value <= 0) return null;

  const params: (string | number)[] = [campaign.id, campaign.starts_at, campaign.ends_at];
  let where = "dc.campaign_id = ? AND d.accepted = 1 AND d.created_at >= ? AND d.created_at <= ?";

  if (campaign.scope === "condo" && campaign.condo_id) {
    where += " AND u.condo_id = ?";
    params.push(campaign.condo_id);
  }

  const base = `FROM deposits d
    JOIN deposit_campaigns dc ON dc.deposit_id = d.id
    JOIN users u ON u.id = d.user_id
    WHERE ${where}`;

  let current = 0;
  if (campaign.target_unit === "kg") {
    const row = get<{ value: number }>(
      `SELECT COALESCE(SUM(d.weight_grams), 0) / 1000.0 AS value ${base}`,
      params,
    );
    current = Math.round(((row?.value ?? 0) + campaign.baseline_value) * 10) / 10;
  } else {
    const row = get<{ value: number }>(`SELECT COUNT(*) AS value ${base}`, params);
    current = (row?.value ?? 0) + Math.round(campaign.baseline_value);
  }

  return { current, target: campaign.target_value, unit: campaign.target_unit };
}

export function isJoined(campaign: CampaignRow, userId: string): boolean {
  const participant = get<{ user_id: string }>(
    "SELECT user_id FROM campaign_participants WHERE campaign_id = ? AND user_id = ?",
    [campaign.id, userId],
  );
  if (participant) return true;
  const deposit = get<{ deposit_id: string }>(
    `SELECT dc.deposit_id FROM deposit_campaigns dc
     JOIN deposits d ON d.id = dc.deposit_id
     WHERE dc.campaign_id = ? AND d.user_id = ? LIMIT 1`,
    [campaign.id, userId],
  );
  return Boolean(deposit);
}

export function campaignView(campaign: CampaignRow, userId: string): CampaignView {
  return {
    id: campaign.id,
    title: campaign.title,
    brand: campaign.brand,
    subtitle: campaign.subtitle,
    material: campaign.material,
    multiplier: campaign.multiplier,
    bonusPoints: campaign.bonus_points,
    startsAt: campaign.starts_at,
    endsAt: campaign.ends_at,
    imageKey: campaign.image_key,
    accent: campaign.accent,
    progress: progressFor(campaign),
    joined: isJoined(campaign, userId),
  };
}

export function listCampaigns(user: UserRow): CampaignView[] {
  const rows = all<CampaignRow>(
    `SELECT * FROM campaigns
     WHERE active = 1 AND ends_at >= ?
     ORDER BY starts_at ASC, title ASC`,
    [nowIso()],
  );
  return rows.map((row) => campaignView(row, user.id));
}

/** Leaderboard scope follows the campaign scope (condo challenge vs. city/national). */
export function campaignLeaderboard(campaign: CampaignRow, user: UserRow): LeaderboardView {
  const scope = campaign.scope === "condo" ? "condo" : "city";
  return buildLeaderboard(user, { scope, campaign, limit: 20 });
}

export function campaignDetail(campaign: CampaignRow, user: UserRow): {
  campaign: CampaignView;
  leaderboard: LeaderboardView["rows"];
  userPosition: { position: number; total: number; value: number; unit: string } | null;
} {
  const view = campaignView(campaign, user.id);
  const board = campaignLeaderboard(campaign, user);
  return {
    campaign: view,
    leaderboard: board.rows,
    userPosition: board.me
      ? {
          position: board.me.position,
          total: board.me.total,
          value: board.me.value,
          unit: board.me.unit,
        }
      : null,
  };
}

/** Registers (or refreshes) campaign participation for a user. */
export function joinCampaign(campaignId: string, userId: string, at = nowIso()): void {
  run(
    `INSERT INTO campaign_participants (campaign_id, user_id, joined_at, items, weight_grams, points_earned)
     VALUES (?, ?, ?, 0, 0, 0)
     ON CONFLICT(campaign_id, user_id) DO NOTHING`,
    [campaignId, userId, at],
  );
}

/** Called once per accepted deposit with every campaign it qualifies for. */
export function recordCampaignDeposit(
  campaignIds: string[],
  userId: string,
  deposit: { weightGrams: number; points: number },
  at: string,
): void {
  for (const campaignId of campaignIds) {
    joinCampaign(campaignId, userId, at);
    run(
      `UPDATE campaign_participants
       SET items = items + 1, weight_grams = weight_grams + ?, points_earned = points_earned + ?
       WHERE campaign_id = ? AND user_id = ?`,
      [deposit.weightGrams, deposit.points, campaignId, userId],
    );
  }
}
