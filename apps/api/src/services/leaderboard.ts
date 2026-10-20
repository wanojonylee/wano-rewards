/**
 * Leaderboards derived purely from SQL aggregation over accepted deposits.
 * scope: condo | building | city, optionally filtered by campaign.
 */
import { all, get } from "../db/index.ts";
import type { CampaignRow, LeaderboardRow, UserRow } from "../types.ts";
import { nowIso } from "../utils/time.ts";

export type LeaderboardScope = "condo" | "building" | "city";

export interface LeaderboardPeriod {
  from: string;
  to: string;
  label: string;
}

export interface LeaderboardMe extends LeaderboardRow {
  total: number;
  percentile: number;
}

export interface LeaderboardView {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  me: LeaderboardMe | null;
}

interface AggRow {
  user_id: string;
  name: string | null;
  avatar_color: string;
  condos_user: string;
  value: number;
}

export interface LeaderboardOptions {
  scope: LeaderboardScope;
  campaign?: CampaignRow | null;
  days?: number;
  limit?: number;
}

function resolveWindow(campaign: CampaignRow | null, days: number): LeaderboardPeriod {
  if (campaign) {
    return {
      from: campaign.starts_at,
      to: campaign.ends_at,
      label: campaign.title,
    };
  }
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  return {
    from,
    to: nowIso(),
    label: days === 30 ? "Últimos 30 dias" : `Últimos ${days} dias`,
  };
}

export function buildLeaderboard(user: UserRow, options: LeaderboardOptions): LeaderboardView {
  const limit = options.limit ?? 20;
  const campaign = options.campaign ?? null;
  const period = resolveWindow(campaign, options.days ?? 30);

  const params: (string | number)[] = [period.from, period.to];
  let where = "d.accepted = 1 AND d.created_at >= ? AND d.created_at <= ? AND u.deleted_at IS NULL";

  if (campaign) {
    where += " AND dc.campaign_id = ?";
    params.push(campaign.id);
  }

  if (options.scope === "condo") {
    where += " AND u.condo_id = ?";
    params.push(user.condo_id ?? "__none__");
  } else if (options.scope === "building") {
    where += " AND u.building_id = ?";
    params.push(user.building_id ?? "__none__");
  } else {
    const city = user.condo_id
      ? get<{ city: string }>("SELECT city FROM condos WHERE id = ?", [user.condo_id])?.city
      : undefined;
    where += " AND u.condo_id IN (SELECT id FROM condos WHERE city = ?)";
    params.push(city ?? "__none__");
  }

  const join = campaign
    ? "JOIN deposit_campaigns dc ON dc.deposit_id = d.id"
    : "";

  const rows = all<AggRow>(
    `SELECT u.id AS user_id, u.name, u.avatar_color, u.condo_id AS condos_user,
            COALESCE(SUM(d.points), 0) AS value
     FROM deposits d
     ${join}
     JOIN users u ON u.id = d.user_id
     WHERE ${where}
     GROUP BY u.id
     ORDER BY value DESC, u.name ASC`,
    params,
  );

  const total = rows.length;
  const mapped: LeaderboardRow[] = rows.map((row, index) => ({
    position: index + 1,
    displayName: row.name?.trim() || "Reciclador RecIO",
    avatarColor: row.avatar_color,
    value: row.value,
    unit: "pts",
    isMe: row.user_id === user.id,
  }));

  const mineIndex = rows.findIndex((row) => row.user_id === user.id);
  const me: LeaderboardMe | null =
    mineIndex >= 0 && mapped[mineIndex]
      ? {
          ...(mapped[mineIndex] as LeaderboardRow),
          total,
          percentile: total > 0 ? Math.max(1, Math.round(((mineIndex + 1) / total) * 100)) : 0,
        }
      : {
          position: 0,
          displayName: user.name?.trim() || "Você",
          avatarColor: user.avatar_color,
          value: 0,
          unit: "pts",
          isMe: true,
          total,
          percentile: 0,
        };

  return {
    scope: options.scope,
    period,
    rows: mapped.slice(0, limit),
    me,
  };
}
