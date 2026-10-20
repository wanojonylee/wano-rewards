import { Router } from "express";
import { z } from "zod";
import { parseWith } from "../middleware/validate.ts";
import { getWallet, listLedger } from "../services/ledger.ts";
import { authUser } from "./helpers.ts";
import type { LedgerRow } from "../types.ts";

const router = Router();

const querySchema = z.object({
  type: z.string().trim().max(40).optional(),
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: number };
    return Number.isFinite(parsed.o) ? Math.max(0, Number(parsed.o)) : 0;
  } catch {
    return 0;
  }
}

function ledgerView(row: LedgerRow) {
  return {
    id: row.id,
    type: row.type,
    pointsDelta: row.points_delta,
    creditDeltaCents: row.credit_delta_cents,
    withdrawableDeltaCents: row.withdrawable_delta_cents,
    balanceAfterPoints: row.balance_after_points,
    balanceAfterCreditCents: row.balance_after_credit_cents,
    description: row.description,
    refType: row.ref_type,
    refId: row.ref_id,
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  res.json(getWallet(authUser(req).id));
});

/** Cursor-paginated statement. `type` accepts earn|redeem|payout|topup|bonus|referral|mini_market|expire. */
router.get("/entries", (req, res) => {
  const user = authUser(req);
  const query = parseWith(querySchema, req.query);
  const offset = decodeCursor(query.cursor);
  const rows = listLedger({ userId: user.id, limit: 200 });
  const filtered = query.type
    ? rows.filter((row) => row.type === query.type)
    : rows;
  const page = filtered.slice(offset, offset + query.limit);
  const nextCursor = offset + query.limit < filtered.length ? encodeCursor(offset + query.limit) : null;
  res.json({ items: page.map(ledgerView), nextCursor });
});

export default router;
