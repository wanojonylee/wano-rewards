/**
 * Double-entry-style ledger service.
 *
 * Every points/credit mutation in the system goes through `applyLedger`, which
 * runs inside one SQLite transaction and atomically:
 *   1. locks the wallet row (BEGIN IMMEDIATE),
 *   2. validates that no balance can go negative,
 *   3. writes the balance snapshot AND the ledger entry together.
 *
 * `balance_after_*` columns make the ledger self-auditing: replaying the rows
 * in order always reproduces the wallet. Idempotency keys are UNIQUE so the same
 * business event can never be credited twice.
 */
import { all, get, run, withTransaction } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { newId } from "../utils/ids.ts";
import { nowIso } from "../utils/time.ts";
import type { LedgerRow, WalletRow } from "../types.ts";

export type LedgerType =
  | "deposit"
  | "campaign_bonus"
  | "referral_bonus"
  | "welcome_bonus"
  | "streak_bonus"
  | "redeem"
  | "topup"
  | "mini_market"
  | "payout"
  | "payout_refund"
  | "refund"
  | "payout_reversal"
  | "adjustment";

export interface LedgerInput {
  userId: string;
  pointsDelta?: number;
  creditDeltaCents?: number;
  withdrawableDeltaCents?: number;
  type: LedgerType;
  refType?: string | null;
  refId?: string | null;
  description: string;
  idempotencyKey?: string | null;
  createdAt?: string;
}

export interface WalletView {
  points: number;
  creditCents: number;
  withdrawableCents: number;
  expiring: { points: number; at: string } | null;
}

export interface LedgerResult {
  entry: LedgerRow;
  wallet: WalletView;
  replayed: boolean;
}

export function walletView(row: Pick<WalletRow, "points" | "credit_cents" | "withdrawable_cents">): WalletView {
  return {
    points: row.points,
    creditCents: row.credit_cents,
    withdrawableCents: row.withdrawable_cents,
    expiring: null,
  };
}

export function ensureWallet(userId: string): void {
  run(
    `INSERT INTO wallet (user_id, points, credit_cents, withdrawable_cents, updated_at)
     VALUES (?, 0, 0, 0, ?) ON CONFLICT(user_id) DO NOTHING`,
    [userId, nowIso()],
  );
}

export function getWalletRow(userId: string): WalletRow {
  ensureWallet(userId);
  const row = get<WalletRow>("SELECT * FROM wallet WHERE user_id = ?", [userId]);
  if (!row) throw new Error(`wallet missing for user ${userId}`);
  return row;
}

export function getWallet(userId: string): WalletView {
  return walletView(getWalletRow(userId));
}

export interface LedgerQuery {
  userId: string;
  limit: number;
  before?: { createdAt: string; id: string } | null;
}

export function listLedger({ userId, limit, before }: LedgerQuery): LedgerRow[] {
  const params: (string | number | null)[] = [userId];
  let where = "user_id = ?";
  if (before) {
    where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
    params.push(before.createdAt, before.createdAt, before.id);
  }
  params.push(limit);
  return all<LedgerRow>(
    `SELECT * FROM ledger_entries WHERE ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    params,
  );
}

function assertInteger(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new ApiError("VALIDATION_ERROR", `${field} deve ser um número inteiro`, 400, { field });
  }
}

/**
 * Applies a ledger movement. Returns the created entry plus resulting wallet.
 * Throws INSUFFICIENT_POINTS / INSUFFICIENT_CREDIT when a debit would make a
 * balance negative — the transaction is rolled back in that case.
 */
export function applyLedger(input: LedgerInput): LedgerResult {
  const pointsDelta = input.pointsDelta ?? 0;
  const creditDelta = input.creditDeltaCents ?? 0;
  const withdrawableDelta = input.withdrawableDeltaCents ?? 0;
  assertInteger(pointsDelta, "pointsDelta");
  assertInteger(creditDelta, "creditDeltaCents");
  assertInteger(withdrawableDelta, "withdrawableDeltaCents");

  return withTransaction(() => {
    if (input.idempotencyKey) {
      const existing = get<LedgerRow>(
        "SELECT * FROM ledger_entries WHERE idempotency_key = ?",
        [input.idempotencyKey],
      );
      if (existing) {
        return { entry: existing, wallet: getWallet(input.userId), replayed: true };
      }
    }

    ensureWallet(input.userId);
    const wallet = getWalletRow(input.userId);

    const nextPoints = wallet.points + pointsDelta;
    const nextCredit = wallet.credit_cents + creditDelta;
    const nextWithdrawable = wallet.withdrawable_cents + withdrawableDelta;

    if (nextPoints < 0) {
      throw new ApiError("INSUFFICIENT_POINTS", "Pontos insuficientes", 400, {
        balancePoints: wallet.points,
        requiredPoints: Math.abs(pointsDelta),
      });
    }
    if (nextCredit < 0) {
      throw new ApiError("INSUFFICIENT_CREDIT", "Saldo insuficiente", 400, {
        balanceCents: wallet.credit_cents,
      });
    }
    if (nextWithdrawable < 0) {
      throw new ApiError("INSUFFICIENT_CREDIT", "Saldo sacável insuficiente", 400, {
        withdrawableCents: wallet.withdrawable_cents,
      });
    }
    if (nextWithdrawable > nextCredit) {
      // Invariant guard: withdrawable credit can never exceed total credit.
      throw new ApiError("INTERNAL_ERROR", "Violação de invariante de saldo", 500);
    }

    const createdAt = input.createdAt ?? nowIso();
    run(
      `UPDATE wallet SET points = ?, credit_cents = ?, withdrawable_cents = ?, updated_at = ? WHERE user_id = ?`,
      [nextPoints, nextCredit, nextWithdrawable, createdAt, input.userId],
    );
    if (pointsDelta > 0) {
      run("UPDATE users SET lifetime_points = lifetime_points + ?, updated_at = ? WHERE id = ?", [
        pointsDelta,
        createdAt,
        input.userId,
      ]);
    }

    const entry: LedgerRow = {
      id: newId("led"),
      user_id: input.userId,
      points_delta: pointsDelta,
      credit_delta_cents: creditDelta,
      withdrawable_delta_cents: withdrawableDelta,
      balance_after_points: nextPoints,
      balance_after_credit_cents: nextCredit,
      balance_after_withdrawable_cents: nextWithdrawable,
      type: input.type,
      ref_type: input.refType ?? null,
      ref_id: input.refId ?? null,
      description: input.description,
      idempotency_key: input.idempotencyKey ?? null,
      created_at: createdAt,
    };

    run(
      `INSERT INTO ledger_entries (
         id, user_id, points_delta, credit_delta_cents, withdrawable_delta_cents,
         balance_after_points, balance_after_credit_cents, balance_after_withdrawable_cents,
         type, ref_type, ref_id, description, idempotency_key, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.user_id,
        entry.points_delta,
        entry.credit_delta_cents,
        entry.withdrawable_delta_cents,
        entry.balance_after_points,
        entry.balance_after_credit_cents,
        entry.balance_after_withdrawable_cents,
        entry.type,
        entry.ref_type,
        entry.ref_id,
        entry.description,
        entry.idempotency_key,
        entry.created_at,
      ],
    );

    return { entry, wallet: walletView({ points: nextPoints, credit_cents: nextCredit, withdrawable_cents: nextWithdrawable }), replayed: false };
  });
}

/** Sum of wallet-affecting ledger deltas — used by invariants and tests. */
export function ledgerTotals(userId: string): { points: number; credit: number; withdrawable: number } {
  const row = get<{ points: number; credit: number; withdrawable: number }>(
    `SELECT COALESCE(SUM(points_delta), 0) AS points,
            COALESCE(SUM(credit_delta_cents), 0) AS credit,
            COALESCE(SUM(withdrawable_delta_cents), 0) AS withdrawable
     FROM ledger_entries WHERE user_id = ?`,
    [userId],
  );
  return row ?? { points: 0, credit: 0, withdrawable: 0 };
}
