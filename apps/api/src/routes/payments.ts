import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams } from "../middleware/validate.ts";
import { checkoutLimiter, payoutLimiter } from "../middleware/rateLimit.ts";
import {
  checkout,
  completeMockPayment,
  getPayment,
  listPacks,
  miniMarketPayment,
} from "../services/payments.ts";
import { createPayout, listPayouts } from "../services/payouts.ts";
import { idParamSchema, redirectUrlSchema } from "../validators.ts";
import { authUser, idempotencyKey } from "./helpers.ts";

const router = Router();

router.get("/payments/packs", (_req, res) => {
  res.json(listPacks());
});

const checkoutSchema = z.object({
  packId: z.string().min(2).max(40),
  successUrl: redirectUrlSchema.default("recio://wallet?status=success"),
  cancelUrl: redirectUrlSchema.default("recio://wallet?status=cancel"),
});

router.post(
  "/payments/checkout",
  checkoutLimiter(),
  validateBody(checkoutSchema),
  async (req, res) => {
    const user = authUser(req);
    const body = req.body as z.infer<typeof checkoutSchema>;
    const result = await checkout(user, body, idempotencyKey(req));
    res.status(result.status).json(result.body);
  },
);

router.post(
  "/payments/mini-market",
  validateBody(
    z.object({
      machineCode: z.string().trim().min(3).max(40),
      amountCents: z.number().int().min(1).max(100_000),
    }),
  ),
  (req, res) => {
    const user = authUser(req);
    const body = req.body as { machineCode: string; amountCents: number };
    res.status(201).json(miniMarketPayment(user, body.machineCode, body.amountCents));
  },
);

router.get("/payments/:id", validateParams(idParamSchema), (req, res) => {
  const user = authUser(req);
  res.json({ payment: getPayment(user.id, req.params.id as string) });
});

router.post("/payments/:id/mock-complete", validateParams(idParamSchema), (req, res) => {
  const user = authUser(req);
  res.json(completeMockPayment(user.id, req.params.id as string));
});

// ---------------------------------------------------------------------------
// Payouts (Pix)
// ---------------------------------------------------------------------------
const payoutSchema = z.object({
  amountCents: z.number().int().min(1).max(1_000_000),
  pixKey: z.string().trim().min(3).max(160),
  pixKeyType: z.enum(["email", "phone", "cpf", "cnpj", "random"]),
});

router.post("/payouts", payoutLimiter(), validateBody(payoutSchema), async (req, res) => {
  const user = authUser(req);
  const body = req.body as z.infer<typeof payoutSchema>;
  const result = await createPayout(user.id, body, idempotencyKey(req));
  res.status(result.status).json(result.body);
});

router.get("/payouts", (req, res) => {
  const user = authUser(req);
  res.json(listPayouts(user.id));
});

export default router;
