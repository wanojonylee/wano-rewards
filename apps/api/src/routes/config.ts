import { Router } from "express";
import { MATERIALS, MATERIAL_CODES, PACKS, RULES, TIERS, pointsPerKg } from "../config/economy.ts";
import { env } from "../env.ts";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    currency: "BRL",
    locale: "pt-BR",
    locales: ["pt-BR", "en"],
    pointsPerKg: pointsPerKg(),
    materials: MATERIAL_CODES.map((code) => {
      const spec = MATERIALS[code];
      return {
        code,
        name: spec.name,
        shortName: spec.shortName,
        pointsPerItem: spec.pointsPerItem,
        cashbackCentsPerItem: spec.cashbackCentsPerItem,
        approxWeightGrams: spec.approxWeightGrams,
        co2GramsPerGram: spec.co2GramsPerGram,
        color: spec.color,
      };
    }),
    legal: {
      privacyUrl: `${env.publicWebUrl}/privacidade`,
      termsUrl: `${env.publicWebUrl}/termos`,
      lgpdContact: env.supportEmail,
      retentionDays: 1825,
      pseudonymizationGraceDays: 30,
    },
    supportEmail: env.supportEmail,
    version: env.version,
    // Additive, mobile-friendly constants (not required by the contract).
    tiers: TIERS,
    limits: {
      payoutMinCents: RULES.payoutMinCents,
      payoutMaxPerRequestCents: RULES.payoutMaxPerRequestCents,
      payoutDailyCapCents: RULES.payoutDailyCapCents,
      payoutFeeCents: RULES.payoutFeeCents,
      sessionTtlMinutes: RULES.sessionTtlMinutes,
      maxItemsPerSession: RULES.maxItemsPerSession,
      weeklyGoalItems: RULES.weeklyGoalItems,
      referralRewardPoints: RULES.referralRewardPoints,
      refereeBonusPoints: RULES.refereeBonusPoints,
    },
    packs: PACKS,
  });
});

export default router;
