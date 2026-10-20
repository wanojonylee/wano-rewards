/**
 * PIX payout reconciliation for operations.
 *
 * `ledgerPayoutCents` is the net amount still retained by the payout ledger
 * (gross debits minus `payout_refund` credits). When every pending/paid payout
 * is backed by a full user debit and every failure was refunded, it equals
 * `paidCents + pendingCents` and `varianceCents` is 0.
 */
import { all, get } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { addDays, nowIso } from "../utils/time.ts";

export interface PayoutReconciliationCounts {
  total: number;
  pending: number;
  paid: number;
  failed: number;
  refunded: number;
}

export interface PayoutProviderReconciliation {
  provider: string;
  counts: PayoutReconciliationCounts;
  requestedCents: number;
  paidCents: number;
  pendingCents: number;
  failedCents: number;
  refundedCents: number;
  feeCents: number;
  ledgerPayoutCents: number;
  varianceCents: number;
}

export interface PayoutReconciliation {
  range: { from: string; to: string };
  counts: PayoutReconciliationCounts;
  requestedCents: number;
  paidCents: number;
  pendingCents: number;
  failedCents: number;
  refundedCents: number;
  feeCents: number;
  ledgerPayoutCents: number;
  varianceCents: number;
  pointsOutstanding: number;
  creditOutstandingCents: number;
  withdrawableOutstandingCents: number;
  balanced: boolean;
  providers: PayoutProviderReconciliation[];
  generatedAt: string;
}

interface PayoutAggregateRow {
  id: string;
  provider: string;
  status: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  ledger_cents: number;
  refunded_cents: number;
}

function emptyCounts(): PayoutReconciliationCounts {
  return { total: 0, pending: 0, paid: 0, failed: 0, refunded: 0 };
}

function emptyProvider(provider: string): PayoutProviderReconciliation {
  return {
    provider,
    counts: emptyCounts(),
    requestedCents: 0,
    paidCents: 0,
    pendingCents: 0,
    failedCents: 0,
    refundedCents: 0,
    feeCents: 0,
    ledgerPayoutCents: 0,
    varianceCents: 0,
  };
}

function accumulate(target: PayoutProviderReconciliation, row: PayoutAggregateRow): void {
  target.counts.total += 1;
  target.requestedCents += row.amount_cents;
  target.ledgerPayoutCents += row.ledger_cents;
  target.refundedCents += row.refunded_cents;
  if (row.refunded_cents > 0) target.counts.refunded += 1;

  if (row.status === "paid") {
    target.counts.paid += 1;
    target.paidCents += row.amount_cents;
    target.feeCents += row.fee_cents;
  } else if (row.status === "pending") {
    target.counts.pending += 1;
    target.pendingCents += row.amount_cents;
    target.feeCents += row.fee_cents;
  } else if (row.status === "failed" || row.status === "rejected") {
    target.counts.failed += 1;
    target.failedCents += row.amount_cents;
  }
}

function normalizeBoundary(value: string, endOfDay: boolean): string {
  const trimmed = value.trim();
  if (!trimmed) throw ApiError.badRequest("VALIDATION_ERROR", "Data inválida", { value });
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw ApiError.badRequest("VALIDATION_ERROR", "Data inválida", { value });
  }
  return new Date(parsed).toISOString();
}

/** Defaults to the last 30 days; accepts `YYYY-MM-DD` or ISO timestamps. */
export function resolveReconciliationRange(
  fromRaw?: string | null,
  toRaw?: string | null,
): { from: string; to: string } {
  const to = toRaw?.trim() ? normalizeBoundary(toRaw, true) : nowIso();
  const from = fromRaw?.trim()
    ? normalizeBoundary(fromRaw, false)
    : addDays(-30, new Date(to));
  if (Date.parse(from) > Date.parse(to)) {
    throw ApiError.badRequest("VALIDATION_ERROR", "`from` deve ser anterior a `to`", { from, to });
  }
  return { from, to };
}

export function reconcilePayouts(from: string, to: string): PayoutReconciliation {
  const rows = all<PayoutAggregateRow>(
    `SELECT p.id, p.provider, p.status, p.amount_cents, p.fee_cents, p.net_cents,
       COALESCE((
         SELECT SUM(CASE WHEN l.type IN ('payout','payout_refund') THEN -l.credit_delta_cents ELSE 0 END)
         FROM ledger_entries l WHERE l.ref_type = 'payout' AND l.ref_id = p.id
       ), 0) AS ledger_cents,
       COALESCE((
         SELECT SUM(l.credit_delta_cents) FROM ledger_entries l
         WHERE l.ref_type = 'payout' AND l.ref_id = p.id AND l.type = 'payout_refund'
       ), 0) AS refunded_cents
     FROM payouts p
     WHERE p.created_at >= ? AND p.created_at <= ?
     ORDER BY p.created_at ASC`,
    [from, to],
  );

  const total = emptyProvider("all");
  const byProvider = new Map<string, PayoutProviderReconciliation>();
  for (const row of rows) {
    accumulate(total, row);
    const provider = byProvider.get(row.provider) ?? emptyProvider(row.provider);
    accumulate(provider, row);
    byProvider.set(row.provider, provider);
  }
  total.varianceCents = total.ledgerPayoutCents - (total.paidCents + total.pendingCents);
  const providers = [...byProvider.values()]
    .map((provider) => {
      provider.varianceCents = provider.ledgerPayoutCents - (provider.paidCents + provider.pendingCents);
      return provider;
    })
    .sort((a, b) => a.provider.localeCompare(b.provider));

  const wallet = get<{
    points: number;
    credit: number;
    withdrawable: number;
  }>(
    `SELECT COALESCE(SUM(points), 0) AS points,
            COALESCE(SUM(credit_cents), 0) AS credit,
            COALESCE(SUM(withdrawable_cents), 0) AS withdrawable
     FROM wallet`,
  ) ?? { points: 0, credit: 0, withdrawable: 0 };
  const ledger = get<{ credit: number; withdrawable: number }>(
    `SELECT COALESCE(SUM(credit_delta_cents), 0) AS credit,
            COALESCE(SUM(withdrawable_delta_cents), 0) AS withdrawable
     FROM ledger_entries`,
  ) ?? { credit: 0, withdrawable: 0 };

  const balanced =
    wallet.withdrawable <= wallet.credit &&
    wallet.credit === ledger.credit &&
    wallet.withdrawable === ledger.withdrawable;

  return {
    range: { from, to },
    counts: total.counts,
    requestedCents: total.requestedCents,
    paidCents: total.paidCents,
    pendingCents: total.pendingCents,
    failedCents: total.failedCents,
    refundedCents: total.refundedCents,
    feeCents: total.feeCents,
    ledgerPayoutCents: total.ledgerPayoutCents,
    varianceCents: total.varianceCents,
    pointsOutstanding: wallet.points,
    creditOutstandingCents: wallet.credit,
    withdrawableOutstandingCents: wallet.withdrawable,
    balanced,
    providers,
    generatedAt: nowIso(),
  };
}
