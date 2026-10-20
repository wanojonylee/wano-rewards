/** Express 5 application factory (no listening — see src/index.ts). */
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { requestContext } from "./middleware/validate.ts";
import { globalLimiter } from "./middleware/rateLimit.ts";
import { errorHandler, notFoundHandler } from "./middleware/error.ts";
import apiRouter from "./routes/index.ts";
import healthRouter from "./routes/health.ts";
import { stripeWebhookHandler, pixWebhookHandler } from "./routes/webhook.ts";

const DEV_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:8082",
  "http://localhost:8787",
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // curl, native apps, server-to-server
  if (!env.isProduction) return true; // Expo dev / LAN origins during development
  return DEV_ORIGINS.includes(origin) || env.corsOrigins.includes(origin);
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isOriginAllowed(origin ?? undefined)),
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Machine-Key", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "Content-Disposition"],
      maxAge: 86_400,
    }),
  );

  app.use(requestContext);
  app.use(globalLimiter);

  // Stripe/PIX need the raw body for signature verification: mount before json().
  app.post(
    `${env.apiPrefix}/webhooks/stripe`,
    express.raw({ type: "application/json", limit: "1mb" }),
    stripeWebhookHandler,
  );
  app.post(
    `${env.apiPrefix}/webhooks/pix`,
    express.raw({ type: "application/json", limit: "1mb" }),
    pixWebhookHandler,
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Health at the root (ops) and under the versioned prefix (contract).
  app.use(healthRouter);
  app.use(env.apiPrefix, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.debug("express app configured", { prefix: env.apiPrefix, cors: env.isProduction ? "whitelist" : "dev-open" });
  return app;
}
