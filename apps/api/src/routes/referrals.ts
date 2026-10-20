import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.ts";
import { applyReferral, getReferral } from "../services/referrals.ts";
import { authUser } from "./helpers.ts";

const router = Router();

router.get("/", (req, res) => {
  res.json(getReferral(authUser(req)));
});

router.post("/apply", validateBody(z.object({ code: z.string().trim().min(3).max(40) })), (req, res) => {
  const user = authUser(req);
  const body = req.body as { code: string };
  res.json(applyReferral(user, body.code));
});

export default router;
