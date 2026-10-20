/**
 * Passwordless OTP auth.
 * - OTPs are stored hashed (never in plain text) with a 5 minute TTL and a
 *   5 attempt budget.
 * - Access token: JWT HS256, 30 days. Refresh token: opaque, hashed in DB,
 *   rotated on every use (reuse revokes the whole family).
 */
import { env } from "../env.ts";
import { ApiError } from "../errors.ts";
import { get, run, withTransaction } from "../db/index.ts";
import { newId, newOpaqueToken } from "../utils/ids.ts";
import { sha256Hex } from "../utils/crypto.ts";
import { addDays, addMinutes, nowIso } from "../utils/time.ts";
import { signAccessToken } from "../middleware/auth.ts";
import { userView, type UserView } from "./profile.ts";
import { ensureWallet } from "./ledger.ts";
import { logger } from "../logger.ts";
import type { UserRow } from "../types.ts";

export interface OtpChallenge {
  sent: true;
  devCode?: string;
  expiresIn: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: UserView;
}

interface OtpRow {
  id: string;
  identifier: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
}

const AVATAR_COLORS = ["#16A34A", "#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];

export function normalizeIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes("@")) return value.toLowerCase();
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.toLowerCase();
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}

function hashCode(identifier: string, code: string): string {
  return sha256Hex(`${identifier}:${code}:${env.jwtSecret}`);
}

function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `RECIO${suffix}`;
}

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}

export function requestOtp(identifierRaw: string, channel: string, requestIp?: string): OtpChallenge {
  const identifier = normalizeIdentifier(identifierRaw);
  const code = env.authDevMode ? "123456" : String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const now = nowIso();
  const expiresAt = addMinutes(env.otpTtlSeconds / 60);

  withTransaction(() => {
    // Invalidate previous outstanding codes for this identifier.
    run("UPDATE otp_codes SET consumed_at = ? WHERE identifier = ? AND consumed_at IS NULL", [
      now,
      identifier,
    ]);
    run(
      `INSERT INTO otp_codes (id, identifier, code_hash, channel, expires_at, attempts, consumed_at, request_ip, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
      [newId("otp"), identifier, hashCode(identifier, code), channel, expiresAt, requestIp ?? null, now],
    );
  });

  if (!env.authDevMode) {
    // SMS/email gateway integration point. The payload is intentionally minimal.
    logger.info("otp dispatch", { channel, identifier: maskIdentifier(identifier) });
  }

  return {
    sent: true,
    ...(env.authDevMode ? { devCode: code } : {}),
    expiresIn: env.otpTtlSeconds,
  };
}

export function maskIdentifier(identifier: string): string {
  if (identifier.includes("@")) {
    const [local = "", domain = ""] = identifier.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `${identifier.slice(0, 5)}****${identifier.slice(-2)}`;
}

interface RefreshRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

function issueTokens(user: UserRow, meta: { userAgent?: string; ip?: string }): {
  accessToken: string;
  refreshToken: string;
  refreshId: string;
} {
  const refreshToken = newOpaqueToken(48);
  const refreshId = newId("rt");
  run(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by_id, user_agent, ip, created_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    [
      refreshId,
      user.id,
      sha256Hex(refreshToken),
      addDays(env.refreshTokenDays),
      meta.userAgent ?? null,
      meta.ip ?? null,
      nowIso(),
    ],
  );
  return { accessToken: signAccessToken(user), refreshToken, refreshId };
}

export function verifyOtp(
  identifierRaw: string,
  code: string,
  locale: string,
  meta: { userAgent?: string; ip?: string },
): AuthSession {
  const identifier = normalizeIdentifier(identifierRaw);
  const now = nowIso();

  const otp = get<OtpRow>(
    `SELECT * FROM otp_codes WHERE identifier = ? ORDER BY created_at DESC LIMIT 1`,
    [identifier],
  );
  if (!otp) throw ApiError.badRequest("INVALID_CODE", "Código inválido");

  if (Date.parse(otp.expires_at) <= Date.now()) {
    run("UPDATE otp_codes SET consumed_at = ? WHERE id = ?", [now, otp.id]);
    throw ApiError.badRequest("CODE_EXPIRED", "Código expirado. Solicite um novo.");
  }
  if (otp.attempts >= env.otpMaxAttempts) {
    throw ApiError.badRequest("TOO_MANY_ATTEMPTS", "Muitas tentativas. Solicite um novo código.");
  }
  if (otp.consumed_at) {
    throw ApiError.badRequest("INVALID_CODE", "Código inválido");
  }

  if (hashCode(identifier, code) !== otp.code_hash) {
    // Attempts are committed OUTSIDE the success transaction on purpose: a
    // rolled-back transaction must never reset the brute-force counter.
    const attempts = otp.attempts + 1;
    run("UPDATE otp_codes SET attempts = ? WHERE id = ?", [attempts, otp.id]);
    if (attempts >= env.otpMaxAttempts) {
      throw ApiError.badRequest("TOO_MANY_ATTEMPTS", "Muitas tentativas. Solicite um novo código.", {
        attemptsRemaining: 0,
      });
    }
    throw ApiError.badRequest("INVALID_CODE", "Código inválido", {
      attemptsRemaining: env.otpMaxAttempts - attempts,
    });
  }

  return withTransaction(() => {
    const fresh = get<OtpRow>("SELECT * FROM otp_codes WHERE id = ?", [otp.id]);
    if (!fresh || fresh.consumed_at) {
      throw ApiError.badRequest("INVALID_CODE", "Código inválido");
    }
    run("UPDATE otp_codes SET consumed_at = ? WHERE id = ?", [now, otp.id]);

    let user = get<UserRow>(
      identifier.includes("@")
        ? "SELECT * FROM users WHERE lower(email) = ?"
        : "SELECT * FROM users WHERE phone = ?",
      [identifier],
    );
    let isNewUser = false;

    if (user?.deleted_at) {
      // Within the 30-day LGPD grace window a user may come back.
      if (user.pseudonymize_after && Date.parse(user.pseudonymize_after) > Date.now()) {
        run("UPDATE users SET deleted_at = NULL, pseudonymize_after = NULL, updated_at = ? WHERE id = ?", [
          now,
          user.id,
        ]);
        user = get<UserRow>("SELECT * FROM users WHERE id = ?", [user.id]) as UserRow;
      } else {
        throw ApiError.forbidden("Conta excluída");
      }
    }

    if (!user) {
      isNewUser = true;
      const id = newId("usr");
      run(
        `INSERT INTO users (id, name, email, phone, locale, avatar_color, role, lifetime_points,
           marketing_opt_in, lgpd_consent_at, created_at, updated_at, referral_code)
         VALUES (?, NULL, ?, ?, ?, ?, 'user', 0, 0, ?, ?, ?, ?)`,
        [
          id,
          isEmail(identifier) ? identifier : null,
          isEmail(identifier) ? null : identifier,
          locale,
          pickAvatarColor(identifier),
          now,
          now,
          now,
          generateReferralCode(),
        ],
      );
      ensureWallet(id);
      user = get<UserRow>("SELECT * FROM users WHERE id = ?", [id]) as UserRow;
    } else if (locale && locale !== user.locale) {
      run("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?", [locale, now, user.id]);
      user.locale = locale;
    }

    const tokens = issueTokens(user, meta);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser,
      user: userView(user),
    };
  });
}

export function refreshSession(
  refreshToken: string,
  meta: { userAgent?: string; ip?: string },
): { accessToken: string; refreshToken: string } {
  const hash = sha256Hex(refreshToken);
  const row = get<RefreshRow>("SELECT * FROM refresh_tokens WHERE token_hash = ?", [hash]);
  if (!row) throw ApiError.unauthorized("Refresh token inválido");

  if (row.revoked_at) {
    // Reuse detection: revoke the whole family, committed immediately.
    run("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [
      nowIso(),
      row.user_id,
    ]);
    throw ApiError.unauthorized("Refresh token reutilizado");
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    throw ApiError.unauthorized("Refresh token expirado");
  }

  const user = get<UserRow>("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [row.user_id]);
  if (!user) throw ApiError.unauthorized("Conta indisponível");

  return withTransaction(() => {
    const current = get<RefreshRow>("SELECT * FROM refresh_tokens WHERE id = ?", [row.id]);
    if (!current || current.revoked_at) throw ApiError.unauthorized("Refresh token inválido");

    const next = newOpaqueToken(48);
    const nextId = newId("rt");
    const now = nowIso();
    run(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by_id, user_agent, ip, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
      [
        nextId,
        user.id,
        sha256Hex(next),
        addDays(env.refreshTokenDays),
        meta.userAgent ?? null,
        meta.ip ?? null,
        now,
      ],
    );
    run("UPDATE refresh_tokens SET revoked_at = ?, replaced_by_id = ? WHERE id = ?", [now, nextId, row.id]);

    return { accessToken: signAccessToken(user), refreshToken: next };
  });
}

export function revokeRefreshToken(refreshToken: string): void {
  run("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", [
    nowIso(),
    sha256Hex(refreshToken),
  ]);
}

export function revokeAllUserTokens(userId: string): void {
  run("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [
    nowIso(),
    userId,
  ]);
}
