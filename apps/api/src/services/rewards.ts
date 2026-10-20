/** Rewards catalog + redemption flow (points debit, stock, codes). */
import { all, get, run, withTransaction } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { newId, newRedemptionCode } from "../utils/ids.ts";
import { addDays, isPast, nowIso } from "../utils/time.ts";
import { decodeCursor, encodeCursor } from "../utils/pagination.ts";
import { applyLedger, getWallet, type WalletView } from "./ledger.ts";
import { notify } from "./notifications.ts";
import { withIdempotency, type IdempotentResult } from "./idempotency.ts";
import type { RedemptionRow, RewardCategory, RewardRow } from "../types.ts";

export interface RewardView {
  id: string;
  title: string;
  subtitle: string;
  category: RewardCategory;
  partner: string;
  pointsCost: number;
  valueCents: number;
  imageKey: string;
  stock: number;
  stockLabel: string;
  isNew: boolean;
  highlight: boolean;
  terms: string;
  expiresAt: string | null;
}

export interface DeliveryInput {
  name: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface RedemptionView {
  id: string;
  code: string;
  qrPayload: string;
  status: RedemptionRow["status"];
  expiresAt: string | null;
  createdAt: string;
  usedAt: string | null;
  fulfilledAt: string | null;
  quantity: number;
  pointsSpent: number;
  valueCents: number;
  reward: Pick<RewardView, "id" | "title" | "subtitle" | "category" | "partner" | "imageKey" | "terms">;
  delivery: DeliveryInput | null;
}

function stockLabel(stock: number): string {
  if (stock <= 0) return "Esgotado";
  if (stock <= 10) return `Últimas ${stock} unidades`;
  return "Disponível";
}

export function rewardView(row: RewardRow): RewardView {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    partner: row.partner,
    pointsCost: row.points_cost,
    valueCents: row.value_cents,
    imageKey: row.image_key,
    stock: row.stock,
    stockLabel: stockLabel(row.stock),
    isNew: Boolean(row.is_new),
    highlight: Boolean(row.highlight),
    terms: row.terms,
    expiresAt: row.expires_at,
  };
}

function parseDelivery(raw: string | null): DeliveryInput | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeliveryInput;
  } catch {
    return null;
  }
}

export function redemptionView(row: RedemptionRow, reward: RewardRow): RedemptionView {
  return {
    id: row.id,
    code: row.code,
    qrPayload: row.qr_payload,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    usedAt: row.used_at,
    fulfilledAt: row.fulfilled_at,
    quantity: row.quantity,
    pointsSpent: row.points_spent,
    valueCents: row.value_cents,
    reward: {
      id: reward.id,
      title: reward.title,
      subtitle: reward.subtitle,
      category: reward.category,
      partner: reward.partner,
      imageKey: reward.image_key,
      terms: reward.terms,
    },
    delivery: parseDelivery(row.delivery_json),
  };
}

/** Lazily expires overdue redemptions (called by list/get endpoints). */
export function expireRedemptions(userId?: string): void {
  const now = nowIso();
  if (userId) {
    run(
      "UPDATE redemptions SET status = 'expired' WHERE user_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < ?",
      [userId, now],
    );
  } else {
    run(
      "UPDATE redemptions SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?",
      [now],
    );
  }
}

export interface ListRewardsOptions {
  category?: RewardCategory;
  search?: string;
  cursor?: string;
  limit: number;
}

export function listRewards(options: ListRewardsOptions): { items: RewardView[]; nextCursor: string | null } {
  const offset = decodeCursor<{ o: number }>(options.cursor)?.o ?? 0;
  const params: (string | number)[] = [];
  const where: string[] = ["active = 1"];
  if (options.category) {
    where.push("category = ?");
    params.push(options.category);
  }
  if (options.search) {
    where.push("(title LIKE ? OR subtitle LIKE ? OR partner LIKE ?)");
    const like = `%${options.search}%`;
    params.push(like, like, like);
  }
  params.push(options.limit + 1, offset);
  const rows = all<RewardRow>(
    `SELECT * FROM rewards WHERE ${where.join(" AND ")}
     ORDER BY highlight DESC, points_cost ASC, id ASC LIMIT ? OFFSET ?`,
    params,
  );
  const hasMore = rows.length > options.limit;
  const items = (hasMore ? rows.slice(0, options.limit) : rows).map(rewardView);
  return {
    items,
    nextCursor: hasMore ? encodeCursor({ o: offset + options.limit }) : null,
  };
}

export function getReward(id: string): { reward: RewardView; related: RewardView[] } {
  const row = get<RewardRow>("SELECT * FROM rewards WHERE id = ? AND active = 1", [id]);
  if (!row) throw ApiError.notFound("Recompensa não encontrada");
  const related = all<RewardRow>(
    `SELECT * FROM rewards WHERE active = 1 AND category = ? AND id != ?
     ORDER BY ABS(points_cost - ?) ASC LIMIT 4`,
    [row.category, row.id, row.points_cost],
  ).map(rewardView);
  return { reward: rewardView(row), related };
}

export interface RedeemInput {
  quantity: number;
  delivery?: DeliveryInput | null;
}

export function redeemReward(
  userId: string,
  rewardId: string,
  input: RedeemInput,
  idempotencyKey: string | undefined,
): IdempotentResult<{ redemption: RedemptionView; wallet: WalletView }> {
  return withIdempotency({
    key: idempotencyKey,
    userId,
    endpoint: `rewards:${rewardId}:redeem`,
    body: input,
    execute: () => {
      const result = withTransaction(() => {
        const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ? AND active = 1", [rewardId]);
        if (!reward) throw ApiError.notFound("Recompensa não encontrada");
        if (isPast(reward.expires_at)) {
          throw new ApiError("REWARD_EXPIRED", "Recompensa expirada", 409);
        }
        const quantity = input.quantity;
        if (reward.requires_delivery && !input.delivery) {
          throw new ApiError(
            "DELIVERY_REQUIRED",
            "Informe o endereço de entrega para este produto físico",
            400,
          );
        }
        const totalPoints = reward.points_cost * quantity;
        const wallet = getWallet(userId);
        if (wallet.points < totalPoints) {
          throw new ApiError("INSUFFICIENT_POINTS", "Pontos insuficientes", 409, {
            balancePoints: wallet.points,
            requiredPoints: totalPoints,
          });
        }

        const stockUpdate = run(
          "UPDATE rewards SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?",
          [quantity, nowIso(), reward.id, quantity],
        );
        if (stockUpdate.changes === 0) {
          throw new ApiError("OUT_OF_STOCK", "Recompensa esgotada", 409);
        }

        const id = newId("rdm");
        const code = newRedemptionCode();
        const createdAt = nowIso();
        const expiresAt = reward.expires_at
          ? new Date(Math.min(Date.parse(reward.expires_at), Date.parse(addDays(90)))).toISOString()
          : addDays(90);

        applyLedger({
          userId,
          pointsDelta: -totalPoints,
          type: "redeem",
          refType: "redemption",
          refId: id,
          description: `Resgate — ${reward.title}`,
          idempotencyKey: `redeem:${id}`,
          createdAt,
        });

        const row: RedemptionRow = {
          id,
          code,
          user_id: userId,
          reward_id: reward.id,
          quantity,
          points_spent: totalPoints,
          value_cents: reward.value_cents * quantity,
          status: "active",
          qr_payload: `recio://redeem/${code}`,
          delivery_json: input.delivery ? JSON.stringify(input.delivery) : null,
          expires_at: expiresAt,
          created_at: createdAt,
          used_at: null,
          fulfilled_at: null,
        };
        run(
          `INSERT INTO redemptions (id, code, user_id, reward_id, quantity, points_spent, value_cents,
             status, qr_payload, delivery_json, expires_at, created_at, used_at, fulfilled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL)`,
          [
            row.id,
            row.code,
            row.user_id,
            row.reward_id,
            row.quantity,
            row.points_spent,
            row.value_cents,
            row.qr_payload,
            row.delivery_json,
            row.expires_at,
            row.created_at,
          ],
        );

        notify({
          userId,
          type: "redemption_created",
          title: "Resgate confirmado",
          body: `${reward.title} — use o código ${code} em ${reward.partner}.`,
          icon: "gift",
          deepLink: `recio://redemptions/${row.id}`,
          createdAt,
        });

        return {
          redemption: redemptionView(row, reward),
          wallet: getWallet(userId),
        };
      });
      return { status: 201, body: result };
    },
  });
}

export interface ListRedemptionsOptions {
  userId: string;
  status?: "active" | "used" | "expired" | "fulfilled";
  cursor?: string;
  limit: number;
}

export function listRedemptions(options: ListRedemptionsOptions): {
  items: RedemptionView[];
  nextCursor: string | null;
} {
  expireRedemptions(options.userId);
  const cursor = decodeCursor<{ createdAt: string; id: string }>(options.cursor);
  const params: (string | number)[] = [options.userId];
  let where = "r.user_id = ?";
  if (options.status) {
    where += " AND r.status = ?";
    params.push(options.status);
  }
  if (cursor) {
    where += " AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?))";
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  params.push(options.limit + 1);
  const rows = all<RedemptionRow & { reward_title: string }>(
    `SELECT r.* FROM redemptions r WHERE ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    params,
  );
  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const items = page
    .map((row) => {
      const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
      return reward ? redemptionView(row, reward) : null;
    })
    .filter((item): item is RedemptionView => item !== null);
  const last = page.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export function getRedemption(userId: string, redemptionId: string): RedemptionView {
  expireRedemptions(userId);
  const row = get<RedemptionRow>("SELECT * FROM redemptions WHERE id = ? AND user_id = ?", [
    redemptionId,
    userId,
  ]);
  if (!row) throw ApiError.notFound("Resgate não encontrado");
  const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
  if (!reward) throw ApiError.notFound("Recompensa não encontrada");
  return redemptionView(row, reward);
}

export function findRedemption(idOrCode: string): RedemptionRow | undefined {
  return get<RedemptionRow>("SELECT * FROM redemptions WHERE id = ? OR code = ?", [idOrCode, idOrCode]);
}

/** Partner cashier flow: marks a redemption as used. Idempotent. */
export function markRedemptionUsed(idOrCode: string): RedemptionView {
  expireRedemptions();
  const row = findRedemption(idOrCode);
  if (!row) throw ApiError.notFound("Resgate não encontrado");
  if (row.status === "active") {
    run("UPDATE redemptions SET status = 'used', used_at = ? WHERE id = ?", [nowIso(), row.id]);
    const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
    notify({
      userId: row.user_id,
      type: "redemption_used",
      title: "Resgate utilizado",
      body: `Seu código ${row.code} foi utilizado com sucesso.`,
      icon: "check",
      deepLink: `recio://redemptions/${row.id}`,
    });
    const updated = get<RedemptionRow>("SELECT * FROM redemptions WHERE id = ?", [row.id]);
    return redemptionView(updated ?? row, reward as RewardRow);
  }
  const reward = get<RewardRow>("SELECT * FROM rewards WHERE id = ?", [row.reward_id]);
  return redemptionView(row, reward as RewardRow);
}
