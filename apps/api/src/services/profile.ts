/** User profile, wallet, tier, impact stats and condo/building rank. */
import { all, get } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { tierFor, type TierView } from "../config/economy.ts";
import { getWallet, type WalletView } from "./ledger.ts";
import { isoWeekKey } from "../utils/time.ts";
import type { UserRow } from "../types.ts";

export interface UserView {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  locale: string;
  avatarColor: string;
  memberSince: string;
  consent: { lgpdAt: string | null; marketingOptIn: boolean };
}

export interface StatsView {
  kgTotal: number;
  itemsTotal: number;
  co2SavedKg: number;
  sessionsTotal: number;
  currentStreakWeeks: number;
}

export interface RankEntry {
  position: number;
  total: number;
  percentile: number;
}

export interface RankView {
  condo: RankEntry;
  building: { position: number; total: number };
}

export interface MeResponse {
  user: UserView;
  wallet: WalletView;
  tier: TierView;
  stats: StatsView;
  rank: RankView;
}

export function userView(row: UserRow): UserView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    locale: row.locale,
    avatarColor: row.avatar_color,
    memberSince: row.created_at,
    consent: {
      lgpdAt: row.lgpd_consent_at,
      marketingOptIn: Boolean(row.marketing_opt_in),
    },
  };
}

export function getUserRow(userId: string): UserRow | undefined {
  return get<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
}

export function requireUserRow(userId: string): UserRow {
  const row = getUserRow(userId);
  if (!row) throw ApiError.notFound("Usuário não encontrado");
  return row;
}

export function statsFor(userId: string): StatsView {
  const totals = get<{ items: number; grams: number; co2: number }>(
    `SELECT COUNT(*) AS items,
            COALESCE(SUM(weight_grams), 0) AS grams,
            COALESCE(SUM(co2_grams), 0) AS co2
     FROM deposits WHERE user_id = ? AND accepted = 1`,
    [userId],
  ) ?? { items: 0, grams: 0, co2: 0 };

  const sessions = get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM sessions WHERE user_id = ? AND status = 'completed'",
    [userId],
  );

  return {
    kgTotal: round2(totals.grams / 1000),
    itemsTotal: totals.items,
    co2SavedKg: round2(totals.co2 / 1000),
    sessionsTotal: sessions?.total ?? 0,
    currentStreakWeeks: currentStreakWeeks(userId),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Consecutive ISO weeks (current or previous week grace) with >= 1 session. */
export function currentStreakWeeks(userId: string): number {
  const days = all<{ day: string }>(
    `SELECT DISTINCT substr(completed_at, 1, 10) AS day
     FROM sessions
     WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
     ORDER BY day DESC LIMIT 400`,
    [userId],
  );
  if (days.length === 0) return 0;
  const weeks = new Set(days.map((row) => isoWeekKey(`${row.day}T12:00:00.000Z`)));

  const now = new Date();
  let cursor = new Date(now.getTime());
  if (!weeks.has(isoWeekKey(cursor))) {
    // Grace: a streak survives until the end of the current week.
    cursor = new Date(now.getTime() - 7 * 86_400_000);
  }
  let streak = 0;
  while (weeks.has(isoWeekKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 7 * 86_400_000);
  }
  return streak;
}

function rankEntry(
  positionRow: { position: number } | undefined,
  totalRow: { total: number } | undefined,
): RankEntry {
  const total = totalRow?.total ?? 0;
  const position = total === 0 ? 0 : (positionRow?.position ?? total);
  const percentile = total === 0 ? 0 : Math.max(1, Math.round((position / total) * 100));
  return { position, total, percentile };
}

export function rankFor(user: Pick<UserRow, "id" | "condo_id" | "building_id" | "deleted_at">): RankView {
  const points = getWallet(user.id).points;

  const condo = user.condo_id
    ? rankEntry(
        get<{ position: number }>(
          `SELECT COUNT(*) + 1 AS position FROM wallet w
           JOIN users u ON u.id = w.user_id
           WHERE u.condo_id = ? AND u.deleted_at IS NULL AND u.id != ? AND w.points > ?`,
          [user.condo_id, user.id, points],
        ),
        get<{ total: number }>(
          `SELECT COUNT(*) AS total FROM users u
           WHERE u.condo_id = ? AND u.deleted_at IS NULL`,
          [user.condo_id],
        ),
      )
    : { position: 0, total: 0, percentile: 0 };

  const building = user.building_id
    ? {
        position:
          (get<{ position: number }>(
            `SELECT COUNT(*) + 1 AS position FROM wallet w
             JOIN users u ON u.id = w.user_id
             WHERE u.building_id = ? AND u.deleted_at IS NULL AND u.id != ? AND w.points > ?`,
            [user.building_id, user.id, points],
          )?.position ?? 0),
        total:
          get<{ total: number }>(
            "SELECT COUNT(*) AS total FROM users u WHERE u.building_id = ? AND u.deleted_at IS NULL",
            [user.building_id],
          )?.total ?? 0,
      }
    : { position: 0, total: 0 };

  return { condo, building };
}

export function buildMe(userId: string): MeResponse {
  const user = requireUserRow(userId);
  const wallet = getWallet(userId);
  return {
    user: userView(user),
    wallet,
    tier: tierFor(user.lifetime_points),
    stats: statsFor(userId),
    rank: rankFor(user),
  };
}
