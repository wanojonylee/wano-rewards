/**
 * Asaas PIX provider (API v3, sandbox-ready).
 *
 * Docs: https://docs.asaas.com/reference/transferir-valor-para-outra-instituicao
 * - POST {ASAAS_BASE_URL}/v3/transfers with `access_token` header
 * - GET  {ASAAS_BASE_URL}/v3/transfers/:id for the current status
 * - webhooks authenticated by the `asaas-access-token` header
 *
 * No SDK: built-in `fetch` with a hard timeout, so the adapter stays light and
 * can be exercised in tests by stubbing `globalThis.fetch`.
 */
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../../errors.ts";
import {
  isRecord,
  parsePixJson,
  readHeader,
  type PixCreatePayoutInput,
  type PixKeyType,
  type PixPayoutResult,
  type PixPayoutStatus,
  type PixPayoutStatusResult,
  type PixProvider,
  type PixProviderErrorCode,
  type PixWebhookEvent,
  type PixWebhookHeaders,
  PixProviderError,
} from "./types.ts";

export const DEFAULT_ASAAS_BASE_URL = "https://sandbox.asaas.com/api";

export interface AsaasPixProviderOptions {
  apiKey: string;
  baseUrl?: string;
  webhookToken: string;
  timeoutMs?: number;
}

const PIX_KEY_TYPES: Record<PixKeyType, string> = {
  email: "EMAIL",
  phone: "PHONE",
  cpf: "CPF",
  cnpj: "CNPJ",
  random: "EVP",
};

const PENDING_STATUSES = new Set([
  "PENDING",
  "IN_BANK",
  "BANK_PROCESSING",
  "CREATED",
  "AWAITING_APPROVAL",
  "PENDING_APPROVAL",
]);
const PAID_STATUSES = new Set(["DONE", "PAID", "COMPLETED", "RECEIVED"]);
const FAILED_STATUSES = new Set(["FAILED", "CANCELLED", "CANCELED", "REJECTED"]);

const PAID_EVENTS = new Set(["TRANSFER_PAID"]);
const FAILED_EVENTS = new Set(["TRANSFER_FAILED", "TRANSFER_CANCELLED", "TRANSFER_CANCELED", "TRANSFER_REJECTED"]);

export function mapAsaasStatus(rawStatus: unknown): PixPayoutStatus {
  const status = typeof rawStatus === "string" ? rawStatus.trim().toUpperCase() : "";
  if (PAID_STATUSES.has(status)) return "paid";
  if (FAILED_STATUSES.has(status)) return "failed";
  if (PENDING_STATUSES.has(status)) return "pending";
  // Unknown statuses are treated as pending: never mark money as paid (or
  // refunded) based on a vocabulary we do not understand.
  return "pending";
}

function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function asaasErrorMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const messages: string[] = [];
  if (Array.isArray(data.errors)) {
    for (const entry of data.errors) {
      if (!isRecord(entry)) continue;
      if (typeof entry.description === "string" && entry.description) messages.push(entry.description);
    }
  }
  if (messages.length > 0) return messages.join("; ");
  if (typeof data.message === "string" && data.message) return data.message;
  return null;
}

function failureReasonFrom(data: unknown): string | null {
  if (!isRecord(data)) return null;
  for (const key of ["failReason", "failureReason", "statusDescription"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export class AsaasPixProvider implements PixProvider {
  readonly name = "asaas" as const;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly webhookToken: string;
  readonly timeoutMs: number;

  constructor(options: AsaasPixProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_ASAAS_BASE_URL).replace(/\/+$/, "");
    this.webhookToken = options.webhookToken;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          access_token: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const code: PixProviderErrorCode = "network_error";
      throw new PixProviderError(
        code,
        error instanceof Error ? error.message : "Falha de rede ao chamar o Asaas",
      );
    }

    const text = await response.text().catch(() => "");
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message = asaasErrorMessage(data) ?? `Asaas HTTP ${response.status}`;
      throw new PixProviderError("http_error", message, response.status);
    }
    return data;
  }

  async createPayout(input: PixCreatePayoutInput): Promise<PixPayoutResult> {
    const data = await this.request("POST", "/v3/transfers", {
      value: Number((input.amountCents / 100).toFixed(2)),
      pixAddressKey: input.pixKey,
      pixAddressKeyType: PIX_KEY_TYPES[input.pixKeyType],
      externalReference: input.payoutId,
      description: input.description,
    });

    if (!isRecord(data) || typeof data.id !== "string" || !data.id) {
      throw new PixProviderError("invalid_response", "Resposta do Asaas sem id de transferência");
    }
    const status = mapAsaasStatus(data.status);
    return {
      providerPayoutId: data.id,
      status,
      failureReason: status === "failed" ? failureReasonFrom(data) : null,
    };
  }

  async getPayoutStatus(providerPayoutId: string): Promise<PixPayoutStatusResult> {
    const data = await this.request("GET", `/v3/transfers/${encodeURIComponent(providerPayoutId)}`);
    if (!isRecord(data)) {
      throw new PixProviderError("invalid_response", "Resposta do Asaas sem corpo");
    }
    const status = mapAsaasStatus(data.status);
    return {
      status,
      failureReason: status === "failed" ? failureReasonFrom(data) : null,
    };
  }

  verifyWebhook(headers: PixWebhookHeaders, rawBody: Buffer): PixWebhookEvent {
    const provided = readHeader(headers, "asaas-access-token");
    if (!this.webhookToken || !provided || !tokensEqual(provided, this.webhookToken)) {
      throw new ApiError("INVALID_SIGNATURE", "Token de webhook Asaas inválido", 400);
    }

    const payload = parsePixJson(rawBody);
    if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.event !== "string") {
      throw new ApiError("VALIDATION_ERROR", "Evento de webhook Asaas inválido", 400);
    }

    const object = isRecord(payload.transfer)
      ? payload.transfer
      : isRecord(payload.payment)
        ? payload.payment
        : {};
    const providerPayoutId = typeof object.id === "string" ? object.id : null;
    const payoutId = typeof object.externalReference === "string" ? object.externalReference : null;
    const type = payload.event;
    const normalized = type.toUpperCase();

    let status: PixWebhookEvent["status"] = "ignored";
    if (PAID_EVENTS.has(normalized)) status = "paid";
    else if (FAILED_EVENTS.has(normalized)) status = "failed";

    const failureReason =
      (typeof payload.failureReason === "string" ? payload.failureReason : null) ??
      (typeof object.failReason === "string" ? object.failReason : null) ??
      (typeof object.failureReason === "string" ? object.failureReason : null);

    return {
      id: payload.id,
      type,
      status,
      providerPayoutId,
      payoutId,
      failureReason,
    };
  }
}
