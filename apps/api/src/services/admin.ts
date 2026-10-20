/** Admin operations: KPIs, CSV export, campaign/reward CRUD, fulfilment. */
import { all, bind, get, iterate, run } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { newId } from "../utils/ids.ts";
import { addDays, nowIso, startOfDayIso } from "../utils/time.ts";
import { writeAudit } from "./audit.ts";
import { updateBoxLevel } from "./machines.ts";
import { notify } from "./notifications.ts";
import { redemptionView, type RedemptionView } from "./rewards.ts";
import type { CampaignRow, RedemptionRow, RewardRow } from "../types.ts";

export interface AdminMetrics {
  dau: number;
  wau: number;
  users: number;
  usersNew7d: number;
  sessionsToday: number;
  sessionsTotal: number;
  depositsToday: number;
  depositsTotal: number;
  itemsToday: number;
  itemsTotal: number;
  pointsIssued: number;
  pointsRedeemed: number;
  redemptionRate: number;
  revenueCents: number;
  payoutPendingCents: number;
  payoutPendingCount: number;
  redemptionsActive: number;
  activeRewards?: number;
  campaignsActive: number;
  depositsByDay: Array<{ date: string; count: number; kg: number }>;
  kgTotal: number;
  co2SavedKg: number;
  machines: { online: number; maintenance: number; full: number };
}

function scalar<T extends Record<string, number>>(sql: string, params: (string | number)[] = []): T {
  return (get<T>(sql, params) ?? ({} as T)) as T;
}

export function adminMetrics(): AdminMetrics {
  const today = startOfDayIso();
  const weekAgo = addDays(-7);
  const monthAgo = addDays(-30);

  const users = scalar<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL",
  ).total;
  const usersNew7d = scalar<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users WHERE created_at >= ?",
    [weekAgo],
  ).total;
  const dau = scalar<{ total: number }>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM deposits WHERE created_at >= ?",
    [today],
  ).total;
  const wau = scalar<{ total: number }>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM deposits WHERE created_at >= ?",
    [weekAgo],
  ).total;
  const depositsToday = scalar<{ total: number }>(
    "SELECT COUNT(*) AS total FROM deposits WHERE accepted = 1 AND created_at >= ?",
    [today],
  ).total;
  const depositsTotal = scalar<{ total: number }>(
    "SELECT COUNT(*) AS total FROM deposits WHERE accepted = 1",
  ).total;
  const pointsIssued = scalar<{ total: number }>(
    "SELECT COALESCE(SUM(points_delta), 0) AS total FROM ledger_entries WHERE points_delta > 0",
  ).total;
  const pointsRedeemed = scalar<{ total: number }>(
    "SELECT COALESCE(SUM(-points_delta), 0) AS total FROM ledger_entries WHERE type = 'redeem'",
  ).total;
  const activeUsers30d = scalar<{ total: number }>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM deposits WHERE created_at >= ?",
    [monthAgo],
  ).total;
  const redeemers30d = scalar<{ total: number }>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM redemptions WHERE created_at >= ?",
    [monthAgo],
  ).total;
  const kg = scalar<{ total: number }>(
    "SELECT COALESCE(SUM(weight_grams), 0) / 1000.0 AS total FROM deposits WHERE accepted = 1",
  ).total;
  const co2 = scalar<{ total: number }>(
    "SELECT COALESCE(SUM(co2_grams), 0) / 1000.0 AS total FROM deposits WHERE accepted = 1",
  ).total;
  const machines = {
    online: scalar<{ total: number }>("SELECT COUNT(*) AS total FROM machines WHERE status = 'online'").total,
    maintenance: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM machines WHERE status = 'maintenance'",
    ).total,
    full: scalar<{ total: number }>("SELECT COUNT(*) AS total FROM machines WHERE status = 'full'").total,
  };

  return {
    dau,
    wau,
    users,
    usersNew7d,
    sessionsToday: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM sessions WHERE started_at >= ?",
      [today],
    ).total,
    sessionsTotal: scalar<{ total: number }>("SELECT COUNT(*) AS total FROM sessions").total,
    depositsToday,
    depositsTotal,
    itemsToday: scalar<{ total: number }>(
      "SELECT COALESCE(SUM(items), 0) AS total FROM sessions WHERE completed_at >= ?",
      [today],
    ).total,
    itemsTotal: depositsTotal,
    pointsIssued,
    pointsRedeemed,
    redemptionRate:
      activeUsers30d > 0 ? Math.round((redeemers30d / activeUsers30d) * 1000) / 10 : 0,
    revenueCents: scalar<{ total: number }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE kind = 'topup' AND status = 'paid'",
    ).total,
    payoutPendingCents: scalar<{ total: number }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payouts WHERE status = 'pending'",
    ).total,
    payoutPendingCount: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM payouts WHERE status = 'pending'",
    ).total,
    redemptionsActive: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM redemptions WHERE status = 'active'",
    ).total,
    campaignsActive: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM campaigns WHERE active = 1 AND ends_at >= ?",
      [nowIso()],
    ).total,
    activeRewards: scalar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM rewards WHERE active = 1",
    ).total,
    depositsByDay: all<{ day: string; count: number; grams: number }>(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count, COALESCE(SUM(weight_grams), 0) AS grams
       FROM deposits
       WHERE accepted = 1 AND created_at >= ?
       GROUP BY day
       ORDER BY day ASC`,
      [addDays(-13)],
    ).map((row) => ({
      date: `${row.day}T12:00:00.000Z`,
      count: Number(row.count ?? 0),
      kg: Math.round((Number(row.grams ?? 0) / 1000) * 10) / 10,
    })),
    kgTotal: Math.round(kg * 100) / 100,
    co2SavedKg: Math.round(co2 * 100) / 100,
    machines,
  };
}

export interface DepositCsvRow {
  id: string;
  created_at: string;
  user_name: string | null;
  user_phone: string | null;
  machine_code: string;
  material: string;
  gtin: string | null;
  sku_name: string | null;
  weight_grams: number;
  accepted: number;
  reject_reason: string | null;
  points: number;
  cashback_cents: number;
  batch_id: string | null;
}

export function* depositCsvRows(from?: string, to?: string): Generator<DepositCsvRow> {
  const params: (string | number)[] = [];
  let where = "1 = 1";
  if (from) {
    where += " AND d.created_at >= ?";
    params.push(from);
  }
  if (to) {
    where += " AND d.created_at <= ?";
    params.push(to);
  }
  const sql = `
    SELECT d.id, d.created_at, u.name AS user_name, u.phone AS user_phone, m.code AS machine_code,
           d.material, d.gtin, d.sku_name, d.weight_grams, d.accepted, d.reject_reason,
           d.points, d.cashback_cents, d.batch_id
    FROM deposits d
    JOIN users u ON u.id = d.user_id
    JOIN machines m ON m.id = d.machine_id
    WHERE ${where}
    ORDER BY d.created_at ASC`;
  yield* iterate<DepositCsvRow>(sql, params);
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export interface CampaignInput {
  title?: string;
  brand?: string | null;
  targetBrand?: string | null;
  subtitle?: string | null;
  material?: string | null;
  multiplier?: number;
  bonusPoints?: number;
  startsAt?: string;
  endsAt?: string;
  imageKey?: string;
  accent?: string;
  targetValue?: number | null;
  baselineValue?: number;
  targetUnit?: string;
  scope?: string;
  condoId?: string | null;
  active?: boolean;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(title: string): string {
  const base = slugify(title) || `campaign-${Date.now()}`;
  let slug = base;
  let counter = 1;
  while (get<{ id: string }>("SELECT id FROM campaigns WHERE slug = ?", [slug])) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

const CAMPAIGN_COLUMNS: Record<string, string> = {
  title: "title",
  brand: "brand",
  targetBrand: "target_brand",
  subtitle: "subtitle",
  material: "material",
  multiplier: "multiplier",
  bonusPoints: "bonus_points",
  startsAt: "starts_at",
  endsAt: "ends_at",
  imageKey: "image_key",
  accent: "accent",
  targetValue: "target_value",
  baselineValue: "baseline_value",
  targetUnit: "target_unit",
  scope: "scope",
  condoId: "condo_id",
  active: "active",
};

function updateSql(
  table: string,
  id: string,
  columns: Record<string, string>,
  patch: object,
): { sql: string; params: ReturnType<typeof bind>[] } | null {
  const values = patch as Record<string, unknown>;
  const sets: string[] = [];
  const params: ReturnType<typeof bind>[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = values[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(bind(value as string | number | boolean | null));
  }
  if (sets.length === 0) return null;
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);
  return { sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, params };
}

export function createCampaign(input: CampaignInput & { title: string }, actorId: string, ip?: string): CampaignRow {
  const now = nowIso();
  const startsAt = input.startsAt ?? now;
  const endsAt = input.endsAt ?? addDays(30);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw ApiError.badRequest("VALIDATION_ERROR", "endsAt deve ser depois de startsAt");
  }
  const row: CampaignRow = {
    id: newId("cmp"),
    slug: uniqueSlug(input.title),
    title: input.title,
    brand: input.brand ?? null,
    target_brand: input.targetBrand ?? null,
    subtitle: input.subtitle ?? null,
    material: (input.material as CampaignRow["material"]) ?? null,
    multiplier: input.multiplier ?? 1,
    bonus_points: input.bonusPoints ?? 0,
    starts_at: startsAt,
    ends_at: endsAt,
    image_key: input.imageKey ?? "bottle",
    accent: input.accent ?? "#10B981",
    target_value: input.targetValue ?? null,
    baseline_value: input.baselineValue ?? 0,
    target_unit: input.targetUnit ?? "items",
    scope: input.scope ?? "national",
    condo_id: input.condoId ?? null,
    active: input.active === false ? 0 : 1,
    created_at: now,
    updated_at: now,
  };
  run(
    `INSERT INTO campaigns (id, slug, title, brand, target_brand, subtitle, material, multiplier,
       bonus_points, starts_at, ends_at, image_key, accent, target_value, baseline_value, target_unit, scope, condo_id,
       active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.slug,
      row.title,
      row.brand,
      row.target_brand,
      row.subtitle,
      row.material,
      row.multiplier,
      row.bonus_points,
      row.starts_at,
      row.ends_at,
      row.image_key,
      row.accent,
      row.target_value,
      row.baseline_value,
      row.target_unit,
      row.scope,
      row.condo_id,
      row.active,
      row.created_at,
      row.updated_at,
    ],
  );
  writeAudit({ actorId, action: "campaign.create", entity: "campaign", entityId: row.id, after: row, ip });
  return row;
}

export function updateCampaign(
  id: string,
  patch: CampaignInput,
  actorId: string,
  ip?: string,
): CampaignRow {
  const before = get<CampaignRow>("SELECT * FROM campaigns WHERE id = ?", [id]);
  if (!before) throw ApiError.notFound("Campanha não encontrada");
  const update = updateSql("campaigns", id, CAMPAIGN_COLUMNS, patch);
  if (update) run(update.sql, update.params);
  const after = get<CampaignRow>("SELECT * FROM campaigns WHERE id = ?", [id]) as CampaignRow;
  writeAudit({ actorId, action: "campaign.update", entity: "campaign", entityId: id, before, after, ip });
  return after;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------
export interface RewardInput {
  title?: string;
  subtitle?: string;
  category?: string;
  partner?: string;
  pointsCost?: number;
  valueCents?: number;
  imageKey?: string;
  stock?: number;
  isNew?: boolean;
  highlight?: boolean;
  terms?: string;
  expiresAt?: string | null;
  requiresDelivery?: boolean;
  active?: boolean;
}

const REWARD_COLUMNS: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  category: "category",
  partner: "partner",
  pointsCost: "points_cost",
  valueCents: "value_cents",
  imageKey: "image_key",
  stock: "stock",
  isNew: "is_new",
  highlight: "highlight",
  terms: "terms",
  expiresAt: "expires_at",
  requiresDelivery: "requires_delivery",
  active: "active",
};

export function createReward(input: RewardInput & { title: string; category: string }, actorId: string, ip?: string): RewardRow {
  const now = nowIso();
  const baseSlug = slugify(input.title) || `reward-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;
  while (get<{ id: string }>("SELECT id FROM rewards WHERE slug = ?", [slug])) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
  const row: RewardRow = {
    id: newId("rwd"),
    slug,
    title: input.title,
    subtitle: input.subtitle ?? "",
    category: input.category as RewardRow["category"],
    partner: input.partner ?? "RecIO",
    points_cost: input.pointsCost ?? 100,
    value_cents: input.valueCents ?? 0,
    image_key: input.imageKey ?? "coffee",
    stock: input.stock ?? 0,
    is_new: input.isNew ? 1 : 0,
    highlight: input.highlight ? 1 : 0,
    terms: input.terms ?? "",
    expires_at: input.expiresAt ?? null,
    requires_delivery: input.requiresDelivery ? 1 : 0,
    active: input.active === false ? 0 : 1,
    created_at: now,
    updated_at: now,
  };
  run(
    `INSERT INTO rewards (id, slug, title, subtitle, category, partner, points_cost, value_cents,
       image_key, stock, is_new, highlight, terms, expires_at, requires_delivery, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.slug,
      row.title,
      row.subtitle,
      row.category,
      row.partner,
      row.points_cost,
      row.value_cents,
      row.image_key,
      row.stock,
      row.is_new,
      row.highlight,
      row.terms,
      row.expires_at,
      row.requires_delivery,
      row.active,
      row.created_at,
      row.updated_at,
    ],
  );
  writeAudit({ actorId, action: "reward.create", entity: "reward", entityId: row.id, after: row, ip });
  return row;
}

export function updateReward(id: string, patch: RewardInput, actorId: string, ip?: string): RewardRow {
  const before = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [id]);
  if (!before) throw ApiError.notFound("Recompensa não encontrada");
  const update = updateSql("rewards", id, REWARD_COLUMNS, patch);
  if (update) run(update.sql, update.params);
  const after = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [id]) as RewardRow;
  writeAudit({ actorId, action: "reward.update", entity: "reward", entityId: id, before, after, ip });
  return after;
}

// ---------------------------------------------------------------------------
// Redemptions & machines
// ---------------------------------------------------------------------------
export interface AdminRedemption extends RedemptionView {
  user: { id: string; name: string | null; phone: string | null };
}

export function adminRedemptions(status?: string): { items: AdminRedemption[] } {
  const params: string[] = [];
  let where = "1 = 1";
  if (status) {
    where = "r.status = ?";
    params.push(status);
  }
  const rows = all<RedemptionRow & { user_name: string | null; user_phone: string | null }>(
    `SELECT r.*, u.name AS user_name, u.phone AS user_phone
     FROM redemptions r JOIN users u ON u.id = r.user_id
     WHERE ${where} ORDER BY r.created_at DESC LIMIT 100`,
    params,
  );
  const items: AdminRedemption[] = [];
  for (const row of rows) {
    const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
    if (!reward) continue;
    items.push({
      ...redemptionView(row, reward),
      user: { id: row.user_id, name: row.user_name, phone: row.user_phone },
    });
  }
  return { items };
}

export function fulfillRedemption(id: string, actorId: string, ip?: string): RedemptionView {
  const row = get<RedemptionRow>("SELECT * FROM redemptions WHERE id = ?", [id]);
  if (!row) throw ApiError.notFound("Resgate não encontrado");
  const before = { status: row.status, fulfilledAt: row.fulfilled_at };
  if (row.status !== "fulfilled") {
    run("UPDATE redemptions SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?", [nowIso(), id]);
    notify({
      userId: row.user_id,
      type: "redemption_fulfilled",
      title: "Resgate a caminho",
      body: "Seu resgate foi processado pela nossa equipe.",
      icon: "gift",
      deepLink: `recio://redemptions/${row.id}`,
    });
  }
  const after = get<RedemptionRow>("SELECT * FROM redemptions WHERE id = ?", [id]);
  const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
  if (!after || !reward) throw ApiError.notFound("Recompensa não encontrada");
  writeAudit({
    actorId,
    action: "redemption.fulfill",
    entity: "redemption",
    entityId: id,
    before,
    after: { status: after.status, fulfilledAt: after.fulfilled_at },
    ip,
  });
  return redemptionView(after, reward);
}

export function setMachineBoxLevel(
  code: string,
  fillPercent: number,
  actorId: string,
  ip?: string,
): Record<string, unknown> {
  const before = get<{ id: string; fill_percent: number; status: string }>(
    "SELECT id, fill_percent, status FROM machines WHERE code = ? COLLATE NOCASE",
    [code],
  );
  if (!before) throw ApiError.notFound("Máquina não encontrada");
  const updated = updateBoxLevel(code, fillPercent);
  writeAudit({
    actorId,
    action: "machine.box_level",
    entity: "machine",
    entityId: updated.id,
    before: { fillPercent: before.fill_percent, status: before.status },
    after: { fillPercent: updated.fill_percent, status: updated.status },
    ip,
  });
  return { code: updated.code, fillPercent: updated.fill_percent, status: updated.status };
}
