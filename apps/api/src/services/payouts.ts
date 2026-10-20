/**
 * PIX payouts: lifecycle, ledger movements and admin operations.
 *
 * Rules
 * - only withdrawable cashback credit can leave the wallet;
 * - the user always pays the gross `amountCents` (credit + withdrawable), the
 *   provider receives `netCents = amountCents - feeCents`;
 * - failures/cancellations refund the full gross amount exactly once through
 *   the ledger (`payout_refund`), so `withdrawable <= credit` keeps holding;
 * - provider calls happen *outside* the SQLite transaction (they are async);
 *   the payout row is persisted first with status `pending`.
 */
import { all, get, run, withTransaction } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { RULES } from "../config/economy.ts";
import { applyLedger, getWallet } from "./ledger.ts";
import { maskPixKey } from "../utils/crypto.ts";
import { newId } from "../utils/ids.ts";
import { nowIso, startOfDayIso } from "../utils/time.ts";
import { notify } from "./notifications.ts";
import { withIdempotencyAsync, type IdempotentResult } from "./idempotency.ts";
import { writeAudit } from "./audit.ts";
import { logger } from "../logger.ts";
import { getPixProvider, type PixKeyType, type PixProvider, type PixPayoutResult } from "./pix/index.ts";
import { decodeCursor, encodeCursor, parseLimit } from "../utils/pagination.ts";
import type { PayoutRow, PayoutStatus } from "../types.ts";

export type { PixKeyType };

export interface PayoutInput {
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
}

export interface PayoutView {
  id: string;
  status: PayoutRow["status"];
  amountCents: number;
  feeCents: number;
  netCents: number;
  pixKeyMasked: string;
  pixKeyType: string;
  estimatedAt: string;
  createdAt: string;
  paidAt: string | null;
  provider: string;
  providerPayoutId: string | null;
  failureReason: string | null;
  retryOf: string | null;
}

export function payoutView(row: PayoutRow): PayoutView {
  return {
    id: row.id,
    status: row.status,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    netCents: row.net_cents,
    pixKeyMasked: row.pix_key_masked,
    pixKeyType: row.pix_key_type,
    estimatedAt: row.estimated_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    provider: row.provider,
    providerPayoutId: row.provider_payout_id,
    failureReason: row.failure_reason,
    retryOf: row.retry_of,
  };
}

export interface AdminPayoutItem {
  id: string;
  userName: string | null;
  userPhone: string | null;
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

export interface AdminPayoutTotals {
  count: number;
  amountCents: number;
  feeCents: number;
  netCents: number;
}

export interface AdminPayoutList {
  items: AdminPayoutItem[];
  nextCursor: string | null;
  totals: AdminPayoutTotals;
}

export type AdminPayoutStatusFilter = "pending" | "paid" | "failed" | "rejected" | "all";

/** Next business day (skips Saturday/Sunday). */
function nextBusinessDay(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString();
}

function dailyPayoutTotal(userId: string): number {
  const row = get<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payouts
     WHERE user_id = ? AND status IN ('pending','paid') AND created_at >= ?`,
    [userId, startOfDayIso()],
  );
  return row?.total ?? 0;
}

function requirePayout(payoutId: string): PayoutRow {
  const row = get<PayoutRow>("SELECT * FROM payouts WHERE id = ?", [payoutId]);
  if (!row) throw ApiError.notFound("Saque não encontrado");
  return row;
}

function sanitizeReason(value: string | null | undefined, fallback: string): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, 300);
}

function providerFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return sanitizeReason(error.message, "Falha no provedor PIX");
  return "Falha no provedor PIX";
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function validateCreateRules(userId: string, amountCents: number): void {
  const wallet = getWallet(userId);
  if (amountCents < RULES.payoutMinCents) {
    throw new ApiError(
      "PAYOUT_TOO_SMALL",
      `Valor mínimo de saque: R$ ${(RULES.payoutMinCents / 100).toFixed(2).replace(".", ",")}`,
      400,
      { minCents: RULES.payoutMinCents },
    );
  }
  if (amountCents > RULES.payoutMaxPerRequestCents) {
    throw new ApiError("PAYOUT_TOO_LARGE", "Valor máximo por saque excedido", 400, {
      maxCents: RULES.payoutMaxPerRequestCents,
    });
  }
  if (amountCents > wallet.withdrawableCents) {
    throw new ApiError("INSUFFICIENT_CREDIT", "Saldo sacável insuficiente", 409, {
      withdrawableCents: wallet.withdrawableCents,
    });
  }
  const alreadyToday = dailyPayoutTotal(userId);
  if (alreadyToday + amountCents > RULES.payoutDailyCapCents) {
    throw new ApiError("PAYOUT_DAILY_CAP", "Limite diário de saque excedido", 400, {
      dailyCapCents: RULES.payoutDailyCapCents,
      usedTodayCents: alreadyToday,
    });
  }
}

interface InsertPayoutOptions {
  userId: string;
  amountCents: number;
  feeCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  provider: string;
  retryOf?: string | null;
}

/**
 * Inserts a pending payout and debits the full gross amount. Must run inside a
 * transaction (the ledger movement joins it).
 */
function insertPendingPayout(options: InsertPayoutOptions): PayoutRow {
  const now = nowIso();
  const id = newId("pyt");
  const fee = Math.max(0, Math.trunc(options.feeCents));
  const net = options.amountCents - fee;
  if (net <= 0) {
    throw new ApiError("PAYOUT_TOO_SMALL", "Taxa de saque maior que o valor solicitado", 400, {
      amountCents: options.amountCents,
      feeCents: fee,
    });
  }
  const pixKeyMasked = maskPixKey(options.pixKey, options.pixKeyType);
  const estimatedAt = nextBusinessDay();

  run(
    `INSERT INTO payouts (id, user_id, amount_cents, fee_cents, net_cents, pix_key, pix_key_type,
       pix_key_masked, status, provider, provider_payout_id, failure_reason, retry_of,
       estimated_at, created_at, paid_at, refunded_at, admin_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?, ?, NULL, NULL, NULL)`,
    [
      id,
      options.userId,
      options.amountCents,
      fee,
      net,
      options.pixKey,
      options.pixKeyType,
      pixKeyMasked,
      options.provider,
      options.retryOf ?? null,
      estimatedAt,
      now,
    ],
  );

  applyLedger({
    userId: options.userId,
    creditDeltaCents: -options.amountCents,
    withdrawableDeltaCents: -options.amountCents,
    type: "payout",
    refType: "payout",
    refId: id,
    description: `Saque Pix — ${pixKeyMasked}`,
    idempotencyKey: `payout:${id}`,
    createdAt: now,
  });

  if (fee > 0) {
    notify({
      userId: options.userId,
      type: "payout_requested",
      title: options.retryOf ? "Saque reenviado" : "Saque solicitado",
      body: `R$ ${(net / 100).toFixed(2).replace(".", ",")} será enviado para ${pixKeyMasked} (taxa de R$ ${(fee / 100).toFixed(2).replace(".", ",")}).`,
      icon: "pix",
      deepLink: "recio://wallet",
      createdAt: now,
    });
  } else {
    notify({
      userId: options.userId,
      type: "payout_requested",
      title: options.retryOf ? "Saque reenviado" : "Saque solicitado",
      body: `R$ ${(options.amountCents / 100).toFixed(2).replace(".", ",")} será enviado para ${pixKeyMasked}.`,
      icon: "pix",
      deepLink: "recio://wallet",
      createdAt: now,
    });
  }

  return requirePayout(id);
}

/**
 * Applies the provider outcome to a pending payout. Runs in its own
 * transaction; joins the caller's transaction when nested.
 */
async function submitToProvider(provider: PixProvider, row: PayoutRow): Promise<PayoutRow> {
  let result: PixPayoutResult;
  try {
    result = await provider.createPayout({
      payoutId: row.id,
      amountCents: row.net_cents,
      pixKey: row.pix_key,
      pixKeyType: row.pix_key_type as PixKeyType,
      description: `Saque RecIO ${row.id}`,
    });
  } catch (error) {
    const reason = providerFailureMessage(error);
    logger.error("pix payout provider call failed", {
      payoutId: row.id,
      provider: provider.name,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    failPayoutWithRefund(row.id, `Falha no provedor: ${reason}`, "provider_error");
    return requirePayout(row.id);
  }

  return withTransaction(() => {
    const current = requirePayout(row.id);
    if (result.providerPayoutId) {
      run("UPDATE payouts SET provider_payout_id = ?, provider = ? WHERE id = ?", [
        result.providerPayoutId,
        provider.name,
        row.id,
      ]);
    }
    if (current.status !== "pending") {
      // A webhook may have settled this payout before the create call returned.
      return requirePayout(row.id);
    }
    if (result.status === "failed") {
      failPayoutWithRefund(
        row.id,
        result.failureReason ?? "Transferência recusada pelo provedor PIX",
        "provider",
      );
      return requirePayout(row.id);
    }
    if (result.status === "paid") {
      run(
        `UPDATE payouts SET status = 'paid', paid_at = ?, failure_reason = NULL,
           provider_payout_id = COALESCE(?, provider_payout_id) WHERE id = ?`,
        [nowIso(), result.providerPayoutId, row.id],
      );
      notify({
        userId: current.user_id,
        type: "payout_paid",
        title: "Saque enviado",
        body: `R$ ${(current.net_cents / 100).toFixed(2).replace(".", ",")} enviado via Pix para ${current.pix_key_masked}.`,
        icon: "pix",
        deepLink: "recio://wallet",
      });
    }
    return requirePayout(row.id);
  });
}

export async function createPayout(
  userId: string,
  input: PayoutInput,
  idempotencyKey: string | undefined,
): Promise<IdempotentResult<{ payout: PayoutView }>> {
  return withIdempotencyAsync({
    key: idempotencyKey,
    userId,
    endpoint: "payouts:create",
    body: input,
    execute: async () => {
      // Resolve before any wallet movement: production misconfiguration must
      // fail cleanly (503) without creating a payout or debiting the user.
      const provider = getPixProvider();
      validateCreateRules(userId, input.amountCents);

      const row = withTransaction(() =>
        insertPendingPayout({
          userId,
          amountCents: input.amountCents,
          feeCents: RULES.payoutFeeCents,
          pixKey: input.pixKey,
          pixKeyType: input.pixKeyType,
          provider: provider.name,
        }),
      );

      const settled = await submitToProvider(provider, row);
      return { status: 201, body: { payout: payoutView(settled) } };
    },
  });
}

export function listPayouts(userId: string): { items: PayoutView[] } {
  const rows = all<PayoutRow>(
    "SELECT * FROM payouts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    [userId],
  );
  return { items: rows.map(payoutView) };
}

export function listAdminPayouts(options: {
  status?: AdminPayoutStatusFilter | null;
  cursor?: string | null;
  limit?: unknown;
}): AdminPayoutList {
  const limit = parseLimit(options.limit, 20, 100);
  const status = options.status ?? "all";
  const statusWhere = status === "all" ? "1 = 1" : "p.status = ?";
  const statusParams: (string | number)[] = status === "all" ? [] : [status];
  const params: (string | number)[] = [...statusParams];
  let where = statusWhere;

  const cursor = decodeCursor<{ createdAt?: unknown; id?: unknown }>(options.cursor ?? null);
  if (options.cursor && (!cursor || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string")) {
    throw ApiError.badRequest("VALIDATION_ERROR", "Cursor inválido");
  }
  if (cursor && typeof cursor.createdAt === "string" && typeof cursor.id === "string") {
    where += " AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))";
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const rows = all<PayoutRow & { user_name: string | null; user_phone: string | null }>(
    `SELECT p.*, u.name AS user_name, u.phone AS user_phone
     FROM payouts p JOIN users u ON u.id = p.user_id
     WHERE ${where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    [...params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  const totalsRow = get<{
    count: number;
    amount_cents: number;
    fee_cents: number;
    net_cents: number;
  }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(p.amount_cents), 0) AS amount_cents,
            COALESCE(SUM(p.fee_cents), 0) AS fee_cents,
            COALESCE(SUM(p.net_cents), 0) AS net_cents
     FROM payouts p WHERE ${statusWhere}`,
    statusParams,
  );

  return {
    items: page.map((row) => ({
      id: row.id,
      userName: row.user_name,
      userPhone: row.user_phone,
      amountCents: row.amount_cents,
      feeCents: row.fee_cents,
      netCents: row.net_cents,
      pixKeyMasked: row.pix_key_masked,
      status: row.status,
      provider: row.provider,
      providerPayoutId: row.provider_payout_id,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.created_at, id: last.id })
        : null,
    totals: {
      count: totalsRow?.count ?? 0,
      amountCents: totalsRow?.amount_cents ?? 0,
      feeCents: totalsRow?.fee_cents ?? 0,
      netCents: totalsRow?.net_cents ?? 0,
    },
  };
}

/** Marks a pending payout as paid (admin/manual settlement). */
export function markPayoutPaid(
  payoutId: string,
  note?: string | null,
  providerPayoutId?: string | null,
): PayoutView {
  return applyPayoutPaid(payoutId, providerPayoutId ?? null, note ?? null);
}

/**
 * Idempotently settles a pending payout as paid. Used by the admin route and
 * by the PIX webhook (`TRANSFER_PAID`).
 */
export function applyPayoutPaid(
  payoutId: string,
  providerPayoutId?: string | null,
  note?: string | null,
): PayoutView {
  return withTransaction(() => {
    const row = requirePayout(payoutId);
    if (row.status === "paid") return payoutView(row);
    if (row.status !== "pending") {
      throw ApiError.conflict("PAYOUT_INVALID_STATE", "Saque não está pendente", {
        status: row.status,
      });
    }
    const now = nowIso();
    run(
      `UPDATE payouts SET status = 'paid', paid_at = ?,
         provider_payout_id = COALESCE(?, provider_payout_id),
         failure_reason = NULL,
         admin_note = COALESCE(?, admin_note)
       WHERE id = ? AND status = 'pending'`,
      [now, providerPayoutId ?? null, note ?? null, payoutId],
    );
    notify({
      userId: row.user_id,
      type: "payout_paid",
      title: "Saque enviado",
      body: `R$ ${(row.net_cents / 100).toFixed(2).replace(".", ",")} enviado via Pix para ${row.pix_key_masked}.`,
      icon: "pix",
      deepLink: "recio://wallet",
      createdAt: now,
    });
    return payoutView(requirePayout(payoutId));
  });
}

/**
 * Marks a pending payout as failed and refunds the full gross amount exactly
 * once. The `payout_refund:<id>` ledger idempotency key makes this safe to
 * call from webhook retries, admin actions and provider errors alike.
 */
export function failPayoutWithRefund(
  payoutId: string,
  reason: string,
  source: "admin" | "webhook" | "provider" | "provider_error" = "admin",
): PayoutView {
  return withTransaction(() => {
    const row = requirePayout(payoutId);
    if (row.status === "failed" || row.status === "rejected") return payoutView(row);
    if (row.status !== "pending") {
      throw ApiError.conflict("PAYOUT_INVALID_STATE", "Saque pago não pode ser estornado", {
        status: row.status,
      });
    }

    const now = nowIso();
    const failureReason = sanitizeReason(reason, "Falha no processamento do saque Pix");
    applyLedger({
      userId: row.user_id,
      creditDeltaCents: row.amount_cents,
      withdrawableDeltaCents: row.amount_cents,
      type: "payout_refund",
      refType: "payout",
      refId: row.id,
      description: `Estorno do saque Pix — ${row.pix_key_masked}`,
      idempotencyKey: `payout_refund:${row.id}`,
      createdAt: now,
    });
    run(
      `UPDATE payouts SET status = 'failed', failure_reason = ?, refunded_at = ?, paid_at = NULL
       WHERE id = ? AND status = 'pending'`,
      [failureReason, now, row.id],
    );
    notify({
      userId: row.user_id,
      type: "payout_failed",
      title: "Saque não realizado",
      body: `R$ ${(row.amount_cents / 100).toFixed(2).replace(".", ",")} foi devolvido ao seu saldo. ${failureReason}`,
      icon: "pix",
      deepLink: "recio://wallet",
      createdAt: now,
    });
    logger.info("pix payout failed and refunded", {
      payoutId: row.id,
      userId: row.user_id,
      source,
      amountCents: row.amount_cents,
    });
    return payoutView(requirePayout(payoutId));
  });
}

/** Admin manual failure with refund. Idempotent for already-failed payouts. */
export function failPayoutManually(payoutId: string, reason?: string | null): PayoutView {
  const row = requirePayout(payoutId);
  if (row.status === "failed" || row.status === "rejected") return payoutView(row);
  if (row.status !== "pending") {
    throw ApiError.conflict("PAYOUT_INVALID_STATE", "Apenas saques pendentes podem falhar", {
      status: row.status,
    });
  }
  return failPayoutWithRefund(
    payoutId,
    reason ?? "Falha manual informada pelo administrador",
    "admin",
  );
}

/**
 * Admin retry: only failed payouts (already refunded by definition). Because
 * the refund happened, the retry must re-debit the user before calling the
 * provider again. A partial unique index allows at most one active retry per
 * original payout; an `Idempotency-Key` additionally makes the HTTP call safe
 * to replay.
 */
export async function retryPayout(
  payoutId: string,
  actorId: string,
  ip?: string,
  idempotencyKey?: string,
): Promise<IdempotentResult<{ payout: PayoutView }>> {
  return withIdempotencyAsync({
    key: idempotencyKey,
    userId: actorId,
    endpoint: "admin:payouts:retry",
    body: { payoutId },
    execute: async () => {
      const original = requirePayout(payoutId);
      if (original.status !== "failed") {
        throw ApiError.conflict("PAYOUT_INVALID_STATE", "Somente saques com falha podem ser reenviados", {
          status: original.status,
        });
      }

      const activeRetry = get<{ id: string; status: string }>(
        `SELECT id, status FROM payouts
         WHERE retry_of = ? AND status IN ('pending','paid') ORDER BY created_at DESC LIMIT 1`,
        [payoutId],
      );
      if (activeRetry) {
        throw ApiError.conflict("PAYOUT_INVALID_STATE", "Já existe uma nova tentativa ativa para este saque", {
          retryPayoutId: activeRetry.id,
          retryStatus: activeRetry.status,
        });
      }

      const provider = getPixProvider();
      const wallet = getWallet(original.user_id);
      if (wallet.withdrawableCents < original.amount_cents || wallet.creditCents < original.amount_cents) {
        throw new ApiError("INSUFFICIENT_CREDIT", "Saldo insuficiente para reenviar o saque", 409, {
          requiredCents: original.amount_cents,
          creditCents: wallet.creditCents,
          withdrawableCents: wallet.withdrawableCents,
        });
      }
      const alreadyToday = dailyPayoutTotal(original.user_id);
      if (alreadyToday + original.amount_cents > RULES.payoutDailyCapCents) {
        throw new ApiError("PAYOUT_DAILY_CAP", "Limite diário de saque excedido", 400, {
          dailyCapCents: RULES.payoutDailyCapCents,
          usedTodayCents: alreadyToday,
        });
      }

      let row: PayoutRow;
      try {
        row = withTransaction(() =>
          insertPendingPayout({
            userId: original.user_id,
            amountCents: original.amount_cents,
            feeCents: original.fee_cents,
            pixKey: original.pix_key,
            pixKeyType: original.pix_key_type as PixKeyType,
            provider: provider.name,
            retryOf: original.id,
          }),
        );
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw ApiError.conflict("PAYOUT_INVALID_STATE", "Já existe uma nova tentativa ativa para este saque");
        }
        throw error;
      }

      const settled = await submitToProvider(provider, row);
      writeAudit({
        actorId,
        action: "payout.retry",
        entity: "payout",
        entityId: settled.id,
        before: { payoutId: original.id, status: original.status },
        after: payoutView(settled),
        ip,
      });
      return { status: 201, body: { payout: payoutView(settled) } };
    },
  });
}

/** Used by the webhook handler to resolve a payout from the provider id. */
export function findPayoutByProviderPayoutId(
  provider: string,
  providerPayoutId: string | null,
): PayoutRow | undefined {
  if (!providerPayoutId) return undefined;
  return get<PayoutRow>(
    "SELECT * FROM payouts WHERE provider = ? AND provider_payout_id = ? ORDER BY created_at DESC LIMIT 1",
    [provider, providerPayoutId],
  );
}

/** Used by the webhook handler when the provider echoes externalReference. */
export function findPayoutById(payoutId: string): PayoutRow | undefined {
  return get<PayoutRow>("SELECT * FROM payouts WHERE id = ?", [payoutId]);
}
