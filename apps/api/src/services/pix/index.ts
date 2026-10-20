/**
 * PIX provider factory.
 *
 * Selection is driven by `PIX_PROVIDER`:
 *   - `mock`  (default in dev/test): deterministic, no network.
 *   - `asaas`: real sandbox/production integration; requires ASAAS_API_KEY.
 *
 * Misconfiguration falls back to mock only outside production. In production a
 * missing/invalid selection or missing Asaas credentials throw a typed 503 when
 * a payout is attempted (never silently fake a transfer).
 */
import { env } from "../../env.ts";
import { ApiError } from "../../errors.ts";
import { logger } from "../../logger.ts";
import { AsaasPixProvider, DEFAULT_ASAAS_BASE_URL } from "./asaas.ts";
import { MockPixProvider } from "./mock.ts";
import type { PixProvider } from "./types.ts";

export interface PixProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  webhookToken?: string;
  production?: boolean;
}

function providerUnavailable(message: string, details?: unknown): ApiError {
  return new ApiError("PAYOUT_PROVIDER_UNAVAILABLE", message, 503, details);
}

export function resolvePixProvider(config: PixProviderConfig): PixProvider {
  const production = config.production ?? false;
  const selected = config.provider.trim().toLowerCase();

  if (selected === "mock") {
    return new MockPixProvider();
  }

  if (selected === "asaas") {
    if (!config.apiKey) {
      if (production) {
        throw providerUnavailable(
          "PIX_PROVIDER=asaas exige ASAAS_API_KEY configurado",
          { provider: "asaas", missing: "ASAAS_API_KEY" },
        );
      }
      logger.warn("pix provider asaas without credentials; falling back to mock", {
        provider: "asaas",
        missing: "ASAAS_API_KEY",
      });
      return new MockPixProvider();
    }
    if (!config.webhookToken) {
      logger.warn("asaas webhook token not configured; PIX webhooks will be rejected", {
        missing: "ASAAS_WEBHOOK_TOKEN",
      });
    }
    return new AsaasPixProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl?.trim() || DEFAULT_ASAAS_BASE_URL,
      webhookToken: config.webhookToken ?? "",
    });
  }

  const label = selected || "(vazio)";
  if (production) {
    throw providerUnavailable(`PIX_PROVIDER inválido em produção: ${label}`, {
      provider: selected,
      allowed: ["mock", "asaas"],
    });
  }
  logger.warn("invalid or missing PIX_PROVIDER; falling back to mock", { provider: label });
  return new MockPixProvider();
}

export function getPixProvider(): PixProvider {
  return resolvePixProvider({
    provider: env.pixProvider,
    apiKey: env.asaasApiKey,
    baseUrl: env.asaasBaseUrl,
    webhookToken: env.asaasWebhookToken,
    production: env.isProduction,
  });
}

export { AsaasPixProvider, DEFAULT_ASAAS_BASE_URL, MockPixProvider };
export type {
  PixCreatePayoutInput,
  PixKeyType,
  PixPayoutResult,
  PixPayoutStatus,
  PixPayoutStatusResult,
  PixProvider,
  PixProviderName,
  PixWebhookEvent,
  PixWebhookHeaders,
} from "./types.ts";
export { PixProviderError } from "./types.ts";
