import { Router } from "express";
import { env, stripeStatus } from "../env.ts";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: env.version,
    mode: env.mode,
    stripe: stripeStatus(),
    uptimeSec: Math.round(process.uptime()),
  });
});

export default router;
