import { Router } from "express";
import { all, get } from "../db/index.ts";
import { authUser } from "./helpers.ts";
import { buildMe } from "../services/profile.ts";

const router = Router();

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Personal impact view: last 6 months, material split, lifetime totals, badges. */
router.get("/", (req, res) => {
  const user = authUser(req);
  const me = buildMe(user.id);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();

  const monthlyRows = all<{ ym: string; grams: number }>(
    `SELECT substr(created_at, 1, 7) AS ym, COALESCE(SUM(weight_grams), 0) AS grams
     FROM deposits
     WHERE user_id = ? AND accepted = 1 AND created_at >= ?
     GROUP BY ym
     ORDER BY ym ASC`,
    [user.id, start],
  );
  const monthly = new Map(monthlyRows.map((row) => [row.ym, Number(row.grams ?? 0)]));

  const months: Array<{ label: string; kg: number }> = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = date.toISOString().slice(0, 7);
    months.push({
      label: MONTH_LABELS[date.getUTCMonth()] ?? "Jan",
      kg: Math.round(((monthly.get(key) ?? 0) / 1000) * 10) / 10,
    });
  }

  const materialRows = all<{ material: string; grams: number }>(
    `SELECT material, COALESCE(SUM(weight_grams), 0) AS grams
     FROM deposits
     WHERE user_id = ? AND accepted = 1
     GROUP BY material
     ORDER BY grams DESC`,
    [user.id],
  );
  const materials = materialRows.map((row) => ({
    material: row.material,
    kg: Math.round((Number(row.grams ?? 0) / 1000) * 10) / 10,
  }));

  const referrals = get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM referrals WHERE referrer_user_id = ? AND status IN ('qualified','rewarded')",
    [user.id],
  )?.total ?? 0;

  const monthKg = months[months.length - 1]?.kg ?? 0;
  const badges = [
    { id: "first", title: "Primeira embalagem", description: "Seu primeiro depósito aprovado.", unlocked: me.stats.itemsTotal >= 1, progress: null },
    { id: "streak4", title: "4 semanas seguidas", description: "Recicle pelo menos uma vez por semana.", unlocked: me.stats.currentStreakWeeks >= 4, progress: null },
    { id: "kg50", title: "50 kg de impacto", description: "Meia tonelada de CO₂ evitada em grupo.", unlocked: me.stats.kgTotal >= 50, progress: null },
    { id: "referral3", title: "Embaixador verde", description: "Convide 3 amigos que reciclem.", unlocked: referrals >= 3, progress: { current: referrals, target: 3 } },
    { id: "month30", title: "Mês de 30 kg", description: "Recicle 30 kg em um único mês.", unlocked: monthKg >= 30, progress: { current: Math.round(monthKg), target: 30 } },
    { id: "guardian", title: "Guardião", description: "Alcance o nível Guardian com 5.000 pontos.", unlocked: me.wallet.points >= 5000, progress: { current: me.wallet.points, target: 5000 } },
  ];

  res.json({
    months,
    materials,
    totals: {
      kg: me.stats.kgTotal,
      co2Kg: me.stats.co2SavedKg,
      items: me.stats.itemsTotal,
      sessions: me.stats.sessionsTotal,
    },
    badges,
  });
});

export default router;
