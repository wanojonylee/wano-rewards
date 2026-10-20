import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.ts";
import { optionalAuth } from "../middleware/auth.ts";
import { otpIdentifierLimiter, otpIpLimiter, verifyLimiter } from "../middleware/rateLimit.ts";
import {
  refreshSession,
  requestOtp,
  revokeAllUserTokens,
  revokeRefreshToken,
  verifyOtp,
} from "../services/auth.ts";
import { identifierSchema, localeSchema } from "../validators.ts";
import { clientIp } from "./helpers.ts";

const router = Router();

const requestOtpSchema = z.object({
  identifier: identifierSchema,
  channel: z.enum(["sms", "email"]).default("sms"),
});

const verifySchema = z.object({
  identifier: identifierSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
  locale: localeSchema.default("pt-BR"),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10).max(500) });

router.post(
  "/request-otp",
  validateBody(requestOtpSchema),
  otpIpLimiter,
  otpIdentifierLimiter,
  (req, res) => {
    const body = req.body as z.infer<typeof requestOtpSchema>;
    const challenge = requestOtp(body.identifier, body.channel, clientIp(req));
    res.json(challenge);
  },
);

router.post("/verify", verifyLimiter, validateBody(verifySchema), (req, res) => {
  const body = req.body as z.infer<typeof verifySchema>;
  const session = verifyOtp(body.identifier, body.code, body.locale, {
    userAgent: req.header("user-agent"),
    ip: clientIp(req),
  });
  res.json(session);
});

router.post("/refresh", validateBody(refreshSchema), (req, res) => {
  const body = req.body as z.infer<typeof refreshSchema>;
  const tokens = refreshSession(body.refreshToken, {
    userAgent: req.header("user-agent"),
    ip: clientIp(req),
  });
  res.json(tokens);
});

router.post("/logout", optionalAuth, (req, res) => {
  const parsed = z.object({ refreshToken: z.string().min(10).max(500).optional() }).safeParse(req.body ?? {});
  const refreshToken = parsed.success ? parsed.data.refreshToken : undefined;
  if (refreshToken) revokeRefreshToken(refreshToken);
  else if (req.auth) revokeAllUserTokens(req.auth.userId);
  res.status(204).end();
});

export default router;
