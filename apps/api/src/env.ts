/**
 * Environment + runtime configuration.
 *
 * Loads `apps/api/.env` (if present) without overriding real process env vars,
 * then exposes a typed, frozen config object used across the app.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository-relative root of the api app (works from src/ and dist/). */
export const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileVars = parseEnvFile(path.join(API_ROOT, ".env"));
for (const [key, value] of Object.entries(fileVars)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

const nodeEnv = str("NODE_ENV", "development");
const isProduction = nodeEnv === "production";
const demoMode = bool("DEMO_MODE", true);
const authDevMode = bool("AUTH_DEV_MODE", true);

const DEFAULT_JWT_SECRET = "recio-dev-jwt-secret-change-me";
const jwtSecret = str("JWT_SECRET", DEFAULT_JWT_SECRET);
if (isProduction && jwtSecret === DEFAULT_JWT_SECRET) {
  throw new Error("JWT_SECRET must be set to a strong random value when NODE_ENV=production");
}

const dbPath = path.resolve(API_ROOT, str("DB_PATH", "data/recio.db"));
const configuredOrigins = str("CORS_ORIGINS", "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  apiRoot: API_ROOT,
  port: num("PORT", 8787),
  host: str("HOST", "0.0.0.0"),
  apiPrefix: "/api/v1",
  version: str("APP_VERSION", "1.0.0"),
  mode: demoMode ? "demo" : "live",
  demoMode,
  authDevMode,
  autoSeed: bool("AUTO_SEED", !isProduction),
  dbPath,
  jwtSecret,
  jwtExpiresInDays: num("JWT_EXPIRES_IN_DAYS", 30),
  refreshTokenDays: num("REFRESH_TOKEN_DAYS", 60),
  otpTtlSeconds: num("OTP_TTL_SECONDS", 300),
  otpMaxAttempts: num("OTP_MAX_ATTEMPTS", 5),
  stripeSecretKey: str("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET", ""),
  stripeCurrency: str("STRIPE_CURRENCY", "brl"),
  // PIX payouts: `mock` in dev/test, `asaas` for the sandbox/production
  // integration. Production must select a provider explicitly.
  pixProvider: str("PIX_PROVIDER", isProduction ? "" : "mock").trim().toLowerCase(),
  asaasApiKey: str("ASAAS_API_KEY", ""),
  asaasBaseUrl: str("ASAAS_BASE_URL", "https://sandbox.asaas.com/api").replace(/\/+$/, ""),
  asaasWebhookToken: str("ASAAS_WEBHOOK_TOKEN", ""),
  pixPayoutFeeCents: Math.max(0, Math.trunc(num("PIX_PAYOUT_FEE_CENTS", 150))),
  pixMinCents: Math.max(1, Math.trunc(num("PIX_MIN_CENTS", 2000))),
  pixDailyCapCents: Math.max(1, Math.trunc(num("PIX_DAILY_CAP_CENTS", 50_000))),
  supportEmail: str("SUPPORT_EMAIL", "ajuda@recio.com.br"),
  logLevel: str("LOG_LEVEL", isProduction ? "info" : "debug"),
  jsonLogs: bool("LOG_JSON", isProduction),
  trustProxy: bool("TRUST_PROXY", false),
  rateLimitDisabled: bool("RATE_LIMIT_DISABLED", false),
  corsOrigins: configuredOrigins,
  appScheme: str("APP_SCHEME", "recio"),
  publicWebUrl: str("PUBLIC_WEB_URL", "https://recio.app"),
});

export type Env = typeof env;

/** Stripe is only used when a real test-mode secret key is configured. */
export function stripeEnabled(): boolean {
  return env.stripeSecretKey.startsWith("sk_");
}

/** Public health/config view of the payment provider. */
export function stripeStatus(): "test" | "unconfigured" {
  return stripeEnabled() ? "test" : "unconfigured";
}
