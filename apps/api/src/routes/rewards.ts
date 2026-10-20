import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.ts";
import { validateBody, validateParams } from "../middleware/validate.ts";
import { redemptionLimiter } from "../middleware/rateLimit.ts";
import {
  getRedemption,
  getReward,
  listRedemptions,
  listRewards,
  markRedemptionUsed,
  redeemReward,
} from "../services/rewards.ts";
import { deliverySchema, idParamSchema } from "../validators.ts";
import { authUser, idempotencyKey } from "./helpers.ts";

const router = Router();

const listSchema = z.object({
  category: z.enum(["voucher", "product", "experience", "donation"]).optional(),
  search: z.string().trim().max(80).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/rewards", (req, res) => {
  const query = listSchema.parse(req.query);
  res.json(
    listRewards({
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
    }),
  );
});

router.get("/rewards/:id", validateParams(idParamSchema), (req, res) => {
  res.json(getReward(req.params.id as string));
});

const redeemSchema = z.object({
  quantity: z.number().int().min(1).max(5).default(1),
  delivery: deliverySchema.optional(),
});

router.post(
  "/rewards/:id/redeem",
  validateParams(idParamSchema),
  validateBody(redeemSchema),
  redemptionLimiter(),
  (req, res) => {
    const user = authUser(req);
    const body = req.body as z.infer<typeof redeemSchema>;
    const result = redeemReward(
      user.id,
      req.params.id as string,
      {
        quantity: body.quantity,
        ...(body.delivery ? { delivery: body.delivery } : {}),
      },
      idempotencyKey(req),
    );
    res.status(result.status).json(result.body);
  },
);

const redemptionQuery = z.object({
  status: z.enum(["active", "used", "expired", "fulfilled"]).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/redemptions", (req, res) => {
  const query = redemptionQuery.parse(req.query);
  const user = authUser(req);
  res.json(
    listRedemptions({
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
    }),
  );
});

router.get("/redemptions/:id", validateParams(idParamSchema), (req, res) => {
  const user = authUser(req);
  res.json({ redemption: getRedemption(user.id, req.params.id as string) });
});

router.post(
  "/redemptions/:id/mark-used",
  requireRole("partner", "admin"),
  validateParams(idParamSchema),
  (req, res) => {
    res.json({ redemption: markRedemptionUsed(req.params.id as string) });
  },
);

export default router;
