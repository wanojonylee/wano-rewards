/** Referral programme: invite code, apply code, double-sided bonus. */
import { env } from "../env.ts";
import { get, run, withTransaction } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { RULES } from "../config/economy.ts";
import { applyLedger } from "./ledger.ts";
import { notify } from "./notifications.ts";
import { newId } from "../utils/ids.ts";
import { nowIso } from "../utils/time.ts";
import type { UserRow } from "../types.ts";

export interface ReferralSummary {
  code: string;
  link: string;
  invited: number;
  earnedPoints: number;
  rewardPerFriend: number;
  refereeBonusPoints: number;
  rules: string[];
}

function ensureReferralCode(user: UserRow): string {
  if (user.referral_code) return user.referral_code;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let suffix = "";
    for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const code = `RECIO${suffix}`;
    const exists = get<{ id: string }>("SELECT id FROM users WHERE referral_code = ?", [code]);
    if (!exists) {
      run("UPDATE users SET referral_code = ?, updated_at = ? WHERE id = ?", [code, nowIso(), user.id]);
      return code;
    }
  }
  throw new Error("could not generate referral code");
}

export function getReferral(user: UserRow): ReferralSummary {
  const code = ensureReferralCode(user);
  const invited = get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM referrals WHERE referrer_user_id = ? AND status = 'applied'",
    [user.id],
  );
  const earned = get<{ total: number }>(
    "SELECT COALESCE(SUM(bonus_points), 0) AS total FROM referrals WHERE referrer_user_id = ? AND status = 'applied'",
    [user.id],
  );
  return {
    code,
    link: `${env.publicWebUrl}/r/${code}`,
    invited: invited?.total ?? 0,
    earnedPoints: earned?.total ?? 0,
    rewardPerFriend: RULES.referralRewardPoints,
    refereeBonusPoints: RULES.refereeBonusPoints,
    rules: [
      "Compartilhe seu código com amigos que ainda não usam o RecIO.",
      `Seu amigo ganha ${RULES.refereeBonusPoints} pontos ao aplicar o código.`,
      `Você ganha ${RULES.referralRewardPoints} pontos após a primeira reciclagem do seu amigo.`,
      "Cada pessoa pode aplicar um código apenas uma vez.",
    ],
  };
}

export function applyReferral(user: UserRow, rawCode: string): { applied: true; bonusPoints: number } {
  const code = rawCode.trim().toUpperCase();
  const referrer = get<UserRow>("SELECT * FROM users WHERE referral_code = ? COLLATE NOCASE", [code]);
  if (!referrer || referrer.id === user.id || referrer.deleted_at) {
    throw ApiError.badRequest("REFERRAL_INVALID", "Código de indicação inválido");
  }
  if (user.referred_by_user_id) {
    throw new ApiError("REFERRAL_ALREADY_APPLIED", "Você já utilizou um código de indicação", 409);
  }
  const existing = get<{ id: string }>("SELECT id FROM referrals WHERE referred_user_id = ?", [user.id]);
  if (existing) {
    throw new ApiError("REFERRAL_ALREADY_APPLIED", "Você já utilizou um código de indicação", 409);
  }

  withTransaction(() => {
    const now = nowIso();
    run(
      `INSERT INTO referrals (id, referrer_user_id, referred_user_id, code, status, bonus_points, created_at, applied_at)
       VALUES (?, ?, ?, ?, 'applied', ?, ?, ?)`,
      [
        newId("ref"),
        referrer.id,
        user.id,
        code,
        RULES.referralRewardPoints,
        now,
        now,
      ],
    );
    run("UPDATE users SET referred_by_user_id = ?, updated_at = ? WHERE id = ?", [
      referrer.id,
      now,
      user.id,
    ]);

    applyLedger({
      userId: user.id,
      pointsDelta: RULES.refereeBonusPoints,
      type: "referral_bonus",
      refType: "referral",
      refId: referrer.id,
      description: "Bônus de indicação",
      idempotencyKey: `referral:referee:${user.id}`,
      createdAt: now,
    });
    applyLedger({
      userId: referrer.id,
      pointsDelta: RULES.referralRewardPoints,
      type: "referral_bonus",
      refType: "referral",
      refId: user.id,
      description: "Indicação aceita",
      idempotencyKey: `referral:referrer:${user.id}`,
      createdAt: now,
    });

    notify({
      userId: user.id,
      type: "referral_bonus",
      title: "Bônus de indicação",
      body: `Você ganhou ${RULES.refereeBonusPoints} pontos por usar o código ${code}.`,
      icon: "gift",
      deepLink: "recio://referral",
      createdAt: now,
    });
    notify({
      userId: referrer.id,
      type: "referral_friend",
      title: "Seu convite funcionou!",
      body: `Você ganhou ${RULES.referralRewardPoints} pontos com a indicação de ${user.name ?? "um novo reciclador"}.`,
      icon: "users",
      deepLink: "recio://referral",
      createdAt: now,
    });
  });

  return { applied: true, bonusPoints: RULES.refereeBonusPoints };
}
