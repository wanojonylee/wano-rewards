/**
 * LGPD: data portability (export), erasure request with 30-day grace, and
 * pseudonymization of due accounts. Ledger/financial rows are retained for
 * accounting but all direct identifiers are removed.
 */
import fs from "node:fs";
import path from "node:path";
import { all, get, run, withTransaction } from "../db/index.ts";
import { API_ROOT, env } from "../env.ts";
import { ApiError } from "../errors.ts";
import { newId } from "../utils/ids.ts";
import { addDays, nowIso } from "../utils/time.ts";
import { logger } from "../logger.ts";
import { userView } from "./profile.ts";
import { getWallet } from "./ledger.ts";
import { revokeAllUserTokens } from "./auth.ts";
import { writeAudit } from "./audit.ts";
import { notify } from "./notifications.ts";
import type { UserRow } from "../types.ts";

export function exportUserData(user: UserRow): { jobId: string; requestedAt: string } {
  const jobId = newId("exp");
  const requestedAt = nowIso();

  const sessions = all<Record<string, unknown>>(
    "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
    [user.id],
  );
  const payload = {
    exportedAt: requestedAt,
    format: "recio.lgpd.export.v1",
    user: userView(user),
    wallet: getWallet(user.id),
    ledger: all<Record<string, unknown>>(
      "SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    sessions,
    deposits: all<Record<string, unknown>>(
      "SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    redemptions: all<Record<string, unknown>>(
      "SELECT * FROM redemptions WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    payments: all<Record<string, unknown>>(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    payouts: all<Record<string, unknown>>(
      "SELECT * FROM payouts WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    notifications: all<Record<string, unknown>>(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at ASC",
      [user.id],
    ),
    referrals: all<Record<string, unknown>>(
      "SELECT * FROM referrals WHERE referrer_user_id = ? OR referred_user_id = ? ORDER BY created_at ASC",
      [user.id, user.id],
    ),
    consent: {
      lgpdAt: user.lgpd_consent_at,
      marketingOptIn: Boolean(user.marketing_opt_in),
      revokedAt: user.lgpd_revoked_at,
    },
  };

  const dir = path.join(API_ROOT, "data", "exports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${jobId}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");

  writeAudit({
    actorId: user.id,
    action: "lgpd.export",
    entity: "user",
    entityId: user.id,
    after: { jobId, file: path.relative(API_ROOT, file) },
  });
  logger.info("lgpd export ready", { userId: user.id, jobId });
  return { jobId, requestedAt };
}

export function requestDeletion(user: UserRow, confirm: string): {
  requested: true;
  pseudonymizeAfter: string;
} {
  if (confirm !== "DELETE") {
    throw ApiError.badRequest("VALIDATION_ERROR", 'Envie { "confirm": "DELETE" } para confirmar');
  }
  const now = nowIso();
  const pseudonymizeAfter = addDays(30);
  withTransaction(() => {
    run(
      `UPDATE users SET deleted_at = ?, pseudonymize_after = ?, marketing_opt_in = 0,
         lgpd_revoked_at = ?, updated_at = ? WHERE id = ?`,
      [now, pseudonymizeAfter, now, now, user.id],
    );
    revokeAllUserTokens(user.id);
  });
  writeAudit({
    actorId: user.id,
    action: "lgpd.delete_requested",
    entity: "user",
    entityId: user.id,
    after: { deletedAt: now, pseudonymizeAfter },
  });
  logger.info("lgpd deletion requested", { userId: user.id, pseudonymizeAfter });
  return { requested: true, pseudonymizeAfter };
}

function pseudonymizeUser(userId: string): void {
  withTransaction(() => {
    const now = nowIso();
    run(
      `UPDATE users SET name = 'Usuário removido', email = NULL, phone = NULL,
         avatar_color = '#94A3B8', marketing_opt_in = 0, pseudonymized = 1,
         referral_code = NULL, referred_by_user_id = NULL, updated_at = ? WHERE id = ?`,
      [now, userId],
    );
    run("DELETE FROM notifications WHERE user_id = ?", [userId]);
    run("UPDATE redemptions SET delivery_json = NULL WHERE user_id = ?", [userId]);
    run("DELETE FROM referrals WHERE referrer_user_id = ? OR referred_user_id = ?", [userId, userId]);
    writeAudit({
      actorId: null,
      action: "lgpd.pseudonymized",
      entity: "user",
      entityId: userId,
      after: { at: now, retained: ["ledger_entries", "deposits", "payments", "payouts"] },
    });
  });
}

/** Runs on boot and is safe to call repeatedly. */
export function pseudonymizeDueUsers(): number {
  const due = all<{ id: string }>(
    `SELECT id FROM users
     WHERE deleted_at IS NOT NULL AND pseudonymized = 0
       AND pseudonymize_after IS NOT NULL AND pseudonymize_after <= ?`,
    [nowIso()],
  );
  for (const row of due) pseudonymizeUser(row.id);
  return due.length;
}

/** Used by tests and the admin surface to assert export jobs exist. */
export function exportJobExists(jobId: string): boolean {
  return fs.existsSync(path.join(API_ROOT, "data", "exports", `${jobId}.json`));
}

export function deletionStatus(userId: string): { deletedAt: string | null; pseudonymizeAfter: string | null } | null {
  const row = get<{ deleted_at: string | null; pseudonymize_after: string | null }>(
    "SELECT deleted_at, pseudonymize_after FROM users WHERE id = ?",
    [userId],
  );
  return row ? { deletedAt: row.deleted_at, pseudonymizeAfter: row.pseudonymize_after } : null;
}

export const LGPD_GRACE_DAYS = 30;
export const LGPD_CONTACT = env.supportEmail;
