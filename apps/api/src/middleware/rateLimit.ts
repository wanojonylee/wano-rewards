/**
 * Rate limiters. Disabled in tests via RATE_LIMIT_DISABLED=true.
 * OTP: 3/min per identifier + 10/min per IP (contract). Payouts/checkout are
 * additionally limited per authenticated user.
 */
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../env.ts";
import { ApiError } from "../errors.ts";

function limiter(overrides: Partial<Options> & Pick<Options, "windowMs" | "limit">): RequestHandler {
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.rateLimitDisabled,
    handler: (_req, _res, next) => {
      next(new ApiError("RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes.", 429));
    },
    validate: { xForwardedForHeader: false, ipv6Subnet: false },
    ...overrides,
  });
}

function identifierKey(req: { body?: unknown; ip?: string | undefined }): string {
  const body = req.body as { identifier?: unknown } | undefined;
  const identifier =
    typeof body?.identifier === "string" && body.identifier.trim()
      ? body.identifier.trim().toLowerCase()
      : null;
  if (identifier) return `otp:${identifier}`;
  return `otp-ip:${ipKeyGenerator(req.ip ?? "127.0.0.1")}`;
}

export const otpIdentifierLimiter = limiter({
  windowMs: 60_000,
  limit: 3,
  keyGenerator: identifierKey,
});

export const otpIpLimiter = limiter({
  windowMs: 60_000,
  limit: 10,
});

export const verifyLimiter = limiter({
  windowMs: 60_000,
  limit: 10,
});

export const redemptionLimiter = (): RequestHandler =>
  limiter({
    windowMs: 60_000,
    limit: 20,
    keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1"),
  });

export const payoutLimiter = (): RequestHandler =>
  limiter({
    windowMs: 60_000,
    limit: 5,
    keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1"),
  });

export const checkoutLimiter = (): RequestHandler =>
  limiter({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1"),
  });

export const globalLimiter = limiter({
  windowMs: 60_000,
  limit: 300,
});
