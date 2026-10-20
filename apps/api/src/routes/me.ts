import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.ts";
import { run } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { nowIso } from "../utils/time.ts";
import { userView } from "../services/profile.ts";
import { buildMe, requireUserRow } from "../services/profile.ts";
import { exportUserData, requestDeletion } from "../services/lgpd.ts";
import { localeSchema } from "../validators.ts";
import { authUser } from "./helpers.ts";
import type { UserRow } from "../types.ts";

const router = Router();

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(160).optional(),
    locale: localeSchema.optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nenhum campo para atualizar");

router.get("/", (req, res) => {
  const user = authUser(req);
  res.json(buildMe(user.id));
});

router.patch("/", validateBody(patchSchema), (req, res) => {
  const user = authUser(req);
  const body = req.body as z.infer<typeof patchSchema>;
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (body.name !== undefined) {
    sets.push("name = ?");
    params.push(body.name);
  }
  if (body.email !== undefined) {
    sets.push("email = ?");
    params.push(body.email.toLowerCase());
  }
  if (body.locale !== undefined) {
    sets.push("locale = ?");
    params.push(body.locale);
  }
  if (body.marketingOptIn !== undefined) {
    sets.push("marketing_opt_in = ?");
    params.push(body.marketingOptIn ? 1 : 0);
  }
  sets.push("updated_at = ?");
  params.push(nowIso(), user.id);
  run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  const updated = requireUserRow(user.id) as UserRow;
  res.json(userView(updated));
});

router.get("/export", (req, res) => {
  const user = authUser(req);
  const job = exportUserData(user);
  res.status(202).json({ jobId: job.jobId });
});

router.delete("/", validateBody(z.object({ confirm: z.string() })), (req, res) => {
  const user = authUser(req);
  const body = req.body as { confirm: string };
  const result = requestDeletion(user, body.confirm);
  res.status(202).json(result);
});

const consentSchema = z.object({ lgpd: z.boolean(), marketing: z.boolean().default(false) });

router.post("/consent", validateBody(consentSchema), (req, res) => {
  const user = authUser(req);
  const body = req.body as z.infer<typeof consentSchema>;
  const now = nowIso();
  if (body.lgpd) {
    run(
      "UPDATE users SET lgpd_consent_at = ?, lgpd_revoked_at = NULL, marketing_opt_in = ?, updated_at = ? WHERE id = ?",
      [now, body.marketing ? 1 : 0, now, user.id],
    );
  } else {
    run(
      "UPDATE users SET lgpd_revoked_at = ?, marketing_opt_in = 0, updated_at = ? WHERE id = ?",
      [now, now, user.id],
    );
  }
  const updated = requireUserRow(user.id);
  if (!updated) throw ApiError.notFound("Usuário não encontrado");
  res.json({
    consent: { lgpdAt: updated.lgpd_consent_at, marketingOptIn: Boolean(updated.marketing_opt_in) },
  });
});

export default router;
