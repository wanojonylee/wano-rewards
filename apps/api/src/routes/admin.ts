import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.ts";
import { parseWith, validateBody, validateParams } from "../middleware/validate.ts";
import { csvRow } from "../utils/csv.ts";
import { ApiError } from "../errors.ts";
import { idParamSchema, materialSchema } from "../validators.ts";
import {
  failPayoutManually,
  listAdminPayouts,
  markPayoutPaid,
  retryPayout,
} from "../services/payouts.ts";
import {
  reconcilePayouts,
  resolveReconciliationRange,
} from "../services/payout-reconciliation.ts";
import {
  adminMetrics,
  adminRedemptions,
  createCampaign,
  createReward,
  depositCsvRows,
  fulfillRedemption,
  setMachineBoxLevel,
  updateCampaign,
  updateReward,
} from "../services/admin.ts";
import { authUser, idempotencyKey } from "./helpers.ts";
import { writeAudit } from "../services/audit.ts";

const router = Router();
router.use(requireRole("admin"));

router.get("/metrics", (_req, res) => {
  res.json(adminMetrics());
});

function normalizeDate(value: string | undefined, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  }
  if (Number.isNaN(Date.parse(value))) {
    throw ApiError.badRequest("VALIDATION_ERROR", "Data inválida", { value });
  }
  return new Date(value).toISOString();
}

const csvQuery = z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() });

router.get("/deposits.csv", (req, res) => {
  const query = csvQuery.parse(req.query);
  const from = normalizeDate(query.from, false);
  const to = normalizeDate(query.to, true);

  res.status(200);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="recio-deposits.csv"');
  res.setHeader("Cache-Control", "no-store");
  res.write("\uFEFF");
  res.write(
    csvRow([
      "id",
      "created_at",
      "user_name",
      "user_phone",
      "machine_code",
      "material",
      "gtin",
      "sku_name",
      "weight_grams",
      "accepted",
      "reject_reason",
      "points",
      "cashback_cents",
      "batch_id",
    ]) + "\r\n",
  );

  let count = 0;
  for (const row of depositCsvRows(from, to)) {
    res.write(
      csvRow([
        row.id,
        row.created_at,
        row.user_name,
        row.user_phone,
        row.machine_code,
        row.material,
        row.gtin,
        row.sku_name,
        row.weight_grams,
        row.accepted,
        row.reject_reason,
        row.points,
        row.cashback_cents,
        row.batch_id,
      ]) + "\r\n",
    );
    count += 1;
    if (count % 500 === 0) res.flushHeaders();
  }
  res.end();
});

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
const campaignBody = z.object({
  title: z.string().trim().min(3).max(120),
  brand: z.string().trim().max(80).nullish(),
  targetBrand: z.string().trim().max(80).nullish(),
  subtitle: z.string().trim().max(200).nullish(),
  material: materialSchema.nullish(),
  multiplier: z.number().min(1).max(10),
  bonusPoints: z.number().int().min(0).max(100_000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  imageKey: z.string().trim().min(2).max(40),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  targetValue: z.number().min(0).max(1_000_000_000).nullish(),
  baselineValue: z.number().min(0).max(1_000_000_000).optional(),
  targetUnit: z.enum(["items", "kg", "referrals"]),
  scope: z.enum(["national", "condo", "city"]),
  condoId: z.string().trim().max(80).nullish(),
  active: z.boolean(),
});

router.post("/campaigns", validateBody(campaignBody), (req, res) => {
  const actor = authUser(req);
  const body = req.body as z.infer<typeof campaignBody>;
  const campaign = createCampaign(
    {
      ...body,
      multiplier: body.multiplier ?? 1,
      bonusPoints: body.bonusPoints ?? 0,
      imageKey: body.imageKey ?? "bottle",
      accent: body.accent ?? "#10B981",
      targetUnit: body.targetUnit ?? "items",
      scope: body.scope ?? "national",
      active: body.active ?? true,
    },
    actor.id,
    req.ip,
  );
  res.status(201).json({ campaign });
});

router.patch(
  "/campaigns/:id",
  validateParams(idParamSchema),
  validateBody(campaignBody.partial()),
  (req, res) => {
    const actor = authUser(req);
    const campaign = updateCampaign(
      req.params.id as string,
      req.body as z.infer<typeof campaignBody>,
      actor.id,
      req.ip,
    );
    res.json({ campaign });
  },
);

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------
const rewardBody = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(200),
  category: z.enum(["voucher", "product", "experience", "donation"]),
  partner: z.string().trim().min(2).max(120),
  pointsCost: z.number().int().min(1).max(1_000_000),
  valueCents: z.number().int().min(0).max(100_000_000),
  imageKey: z.string().trim().min(2).max(40),
  stock: z.number().int().min(0).max(1_000_000),
  isNew: z.boolean(),
  highlight: z.boolean(),
  terms: z.string().max(1000),
  expiresAt: z.string().datetime().nullish(),
  requiresDelivery: z.boolean(),
  active: z.boolean(),
});

router.post("/rewards", validateBody(rewardBody), (req, res) => {
  const actor = authUser(req);
  const body = req.body as z.infer<typeof rewardBody>;
  const reward = createReward(body, actor.id, req.ip);
  res.status(201).json({ reward });
});

router.patch("/rewards/:id", validateParams(idParamSchema), validateBody(rewardBody.partial()), (req, res) => {
  const actor = authUser(req);
  const reward = updateReward(req.params.id as string, req.body as z.infer<typeof rewardBody>, actor.id, req.ip);
  res.json({ reward });
});

// ---------------------------------------------------------------------------
// Redemptions & machines & payouts
// ---------------------------------------------------------------------------
router.get("/redemptions", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(adminRedemptions(status));
});

router.post("/redemptions/:id/fulfill", validateParams(idParamSchema), (req, res) => {
  const actor = authUser(req);
  res.json({ redemption: fulfillRedemption(req.params.id as string, actor.id, req.ip) });
});

router.post(
  "/machines/:code/box-level",
  validateBody(z.object({ fillPercent: z.number().int().min(0).max(100) })),
  (req, res) => {
    const actor = authUser(req);
    const body = req.body as { fillPercent: number };
    res.json({
      machine: setMachineBoxLevel(req.params.code as string, body.fillPercent, actor.id, req.ip),
    });
  },
);

const payoutStatusSchema = z.enum(["pending", "paid", "failed", "rejected", "all"]);
const payoutListQuerySchema = z.object({
  status: payoutStatusSchema.optional(),
  cursor: z.string().max(600).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

router.get("/payouts", (req, res) => {
  const query = parseWith(payoutListQuerySchema, req.query);
  res.json(
    listAdminPayouts({
      status: query.status ?? "all",
      cursor: query.cursor ?? null,
      limit: query.limit,
    }),
  );
});

router.post(
  "/payouts/:id/paid",
  validateParams(idParamSchema),
  validateBody(
    z
      .object({
        note: z.string().max(300).optional(),
        providerPayoutId: z.string().trim().min(1).max(120).optional(),
      })
      .default({}),
  ),
  (req, res) => {
    const actor = authUser(req);
    const body = req.body as { note?: string; providerPayoutId?: string };
    const payout = markPayoutPaid(
      req.params.id as string,
      body.note ?? null,
      body.providerPayoutId ?? null,
    );
    writeAudit({
      actorId: actor.id,
      action: "payout.paid",
      entity: "payout",
      entityId: payout.id,
      after: payout,
      ip: req.ip,
    });
    res.json({ payout });
  },
);

router.post(
  "/payouts/:id/retry",
  validateParams(idParamSchema),
  async (req, res) => {
    const actor = authUser(req);
    const result = await retryPayout(
      req.params.id as string,
      actor.id,
      req.ip,
      idempotencyKey(req),
    );
    res.status(result.status).json(result.body);
  },
);

router.post(
  "/payouts/:id/fail",
  validateParams(idParamSchema),
  validateBody(z.object({ reason: z.string().trim().max(300).optional() }).default({})),
  (req, res) => {
    const actor = authUser(req);
    const body = req.body as { reason?: string };
    const payout = failPayoutManually(req.params.id as string, body.reason ?? null);
    writeAudit({
      actorId: actor.id,
      action: "payout.fail",
      entity: "payout",
      entityId: payout.id,
      after: payout,
      ip: req.ip,
    });
    res.json({ payout });
  },
);

const reconciliationQuerySchema = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
});

router.get("/reconciliation", (req, res) => {
  const query = parseWith(reconciliationQuerySchema, req.query);
  const range = resolveReconciliationRange(query.from, query.to);
  res.json(reconcilePayouts(range.from, range.to));
});

export default router;
