/**
 * Provider-agnostic PIX payout contract.
 *
 * The payout domain only knows about this interface: every provider receives
 * the *net* amount that should reach the user (fee already deducted) and maps
 * its own status vocabulary to pending/paid/failed.
 */
import { ApiError } from "../../errors.ts";

export type PixKeyType = "email" | "phone" | "cpf" | "cnpj" | "random";

export type PixProviderName = "mock" | "asaas";

export type PixPayoutStatus = "pending" | "paid" | "failed";

export interface PixCreatePayoutInput {
  /** Internal payout id, sent to the provider as `externalReference`. */
  payoutId: string;
  /** Amount the provider must transfer (amountCents - feeCents). */
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  description: string;
}

export interface PixPayoutResult {
  providerPayoutId: string;
  status: PixPayoutStatus;
  failureReason?: string | null;
}

export interface PixPayoutStatusResult {
  status: PixPayoutStatus;
  failureReason?: string | null;
}

/** Express/Node header bag (values may be a single string or an array). */
export type PixWebhookHeaders = Record<string, string | string[] | undefined>;

export interface PixWebhookEvent {
  /** Provider event id — the idempotency key in `webhook_events`. */
  id: string;
  /** Raw provider event type (e.g. TRANSFER_PAID). */
  type: string;
  status: PixPayoutStatus | "ignored";
  providerPayoutId: string | null;
  /** Internal payout id when the provider echoes `externalReference`. */
  payoutId?: string | null;
  failureReason?: string | null;
}

export interface PixProvider {
  readonly name: PixProviderName;
  createPayout(input: PixCreatePayoutInput): Promise<PixPayoutResult>;
  getPayoutStatus(providerPayoutId: string): Promise<PixPayoutStatusResult>;
  /**
   * Verifies authenticity and normalizes the provider payload. Must throw an
   * `ApiError` (400 INVALID_SIGNATURE) when the signature/token is invalid.
   */
  verifyWebhook(headers: PixWebhookHeaders, rawBody: Buffer): PixWebhookEvent;
}

export type PixProviderErrorCode = "http_error" | "invalid_response" | "network_error";

/** Low-level provider failure (transport/invalid payload), safe to log. */
export class PixProviderError extends Error {
  readonly code: PixProviderErrorCode;
  readonly statusCode?: number;

  constructor(code: PixProviderErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = "PixProviderError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Case-insensitive header lookup for webhook verification. */
export function readHeader(headers: PixWebhookHeaders, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    if (Array.isArray(value)) return value[0];
    return value;
  }
  return undefined;
}

export function parsePixJson(rawBody: Buffer): unknown {
  try {
    return JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Payload de webhook PIX inválido", 400);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
