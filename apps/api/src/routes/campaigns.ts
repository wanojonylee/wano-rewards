import { Router } from "express";
import { z } from "zod";
import {
  campaignDetail,
  campaignRow,
  listCampaigns,
  requireCampaign,
} from "../services/campaigns.ts";
import { buildLeaderboard } from "../services/leaderboard.ts";
import { authUser } from "./helpers.ts";

const router = Router();

router.get("/campaigns", (req, res) => {
  const user = authUser(req);
  res.json({ items: listCampaigns(user) });
});

const leaderboardQuery = z.object({
  scope: z.enum(["condo", "building", "city"]).default("condo"),
  campaignId: z.string().max(80).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/leaderboard", (req, res) => {
  const user = authUser(req);
  const query = leaderboardQuery.parse(req.query);
  const campaign = query.campaignId ? campaignRow(query.campaignId) : undefined;
  if (query.campaignId && !campaign) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Campanha não encontrada" },
      requestId: req.id,
    });
    return;
  }
  const board = buildLeaderboard(user, {
    scope: query.scope,
    ...(campaign ? { campaign } : {}),
    days: query.days,
    limit: query.limit,
  });
  res.json(board);
});

router.get("/campaigns/:id", (req, res) => {
  const user = authUser(req);
  const campaign = requireCampaign(req.params.id as string);
  res.json(campaignDetail(campaign, user));
});

export default router;
