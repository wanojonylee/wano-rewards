import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.ts";
import { validateBody, validateParams } from "../middleware/validate.ts";
import {
  completeSession,
  getSessionForUser,
  simulateDeposit,
  startSession,
} from "../services/sessions.ts";
import { idParamSchema, materialSchema } from "../validators.ts";
import { authUser } from "./helpers.ts";
import { MATERIAL_CODES } from "../config/economy.ts";

const router = Router();

const startSchema = z.object({
  machineCode: z.string().trim().min(3).max(40),
  source: z.enum(["qr", "nfc", "manual", "demo"]).default("qr"),
});

router.post("/sessions/start", authenticate, validateBody(startSchema), (req, res) => {
  const user = authUser(req);
  const body = req.body as z.infer<typeof startSchema>;
  const result = startSession(user, body.machineCode, body.source);
  res.status(201).json(result);
});

router.get("/sessions/:id", authenticate, validateParams(idParamSchema), (req, res) => {
  const user = authUser(req);
  const isAdmin = user.role === "admin";
  res.json({ session: getSessionForUser(user.id, req.params.id as string, isAdmin) });
});

router.post("/sessions/:id/complete", authenticate, validateParams(idParamSchema), (req, res) => {
  const user = authUser(req);
  res.json({ session: completeSession(user, req.params.id as string) });
});

const simulateSchema = z.object({ material: materialSchema.optional() });

router.post(
  "/sessions/:id/simulate-deposit",
  authenticate,
  validateParams(idParamSchema),
  validateBody(simulateSchema),
  (req, res) => {
    const user = authUser(req);
    const body = req.body as z.infer<typeof simulateSchema>;
    const result = simulateDeposit(
      user,
      req.params.id as string,
      body.material as (typeof MATERIAL_CODES)[number] | undefined,
    );
    res.json(result);
  },
);

export default router;
