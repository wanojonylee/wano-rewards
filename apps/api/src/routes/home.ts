import { Router } from "express";
import { get } from "../db/index.ts";
import { RULES } from "../config/economy.ts";
import { buildMe } from "../services/profile.ts";
import { getWallet } from "../services/ledger.ts";
import { listLedger } from "../services/ledger.ts";
import { listCampaigns } from "../services/campaigns.ts";
import { listMachines } from "../services/machines.ts";
import { weekBounds } from "../utils/time.ts";
import { authUser } from "./helpers.ts";

const router = Router();

router.get("/", (req, res) => {
  const user = authUser(req);
  const me = buildMe(user.id);
  const bounds = weekBounds();
  const weekItems =
    get<{ items: number }>(
      `SELECT COUNT(*) AS items FROM deposits
       WHERE user_id = ? AND accepted = 1 AND created_at >= ? AND created_at <= ?`,
      [user.id, bounds.start, bounds.end],
    )?.items ?? 0;

  const condoMachines = user.condo_id
    ? listMachines({ condoId: user.condo_id }).filter((machine) => machine.status !== "maintenance")
    : [];
  const nearbyMachine = condoMachines[0] ?? listMachines()[0] ?? null;

  res.json({
    wallet: getWallet(user.id),
    tier: me.tier,
    stats: me.stats,
    rank: me.rank,
    campaigns: listCampaigns(user),
    recent: listLedger({ userId: user.id, limit: 5 }).map((entry) => ({
      id: entry.id,
      type: entry.type,
      description: entry.description,
      pointsDelta: entry.points_delta,
      creditDeltaCents: entry.credit_delta_cents,
      balanceAfterPoints: entry.balance_after_points,
      createdAt: entry.created_at,
    })),
    nearbyMachine,
    weeklyGoal: {
      targetItems: RULES.weeklyGoalItems,
      currentItems: weekItems,
      percent: Math.min(100, Math.round((weekItems / RULES.weeklyGoalItems) * 100)),
      unit: "items",
      bonusPoints: RULES.weeklyGoalBonusPoints,
      weekStart: bounds.start,
      weekEnd: bounds.end,
    },
    greetingName: user.name?.trim().split(" ")[0] ?? "Reciclador",
  });
});

export default router;
