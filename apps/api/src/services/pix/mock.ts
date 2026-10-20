/**
 * Deterministic PIX provider for dev/test.
 *
 * - creates a `mock_pix_*` id with status `pending`;
 * - a Pix key ending in `@fail.test` makes the transfer fail immediately, which
 *   lets tests exercise the refund path without a webhook;
 * - `verifyWebhook` accepts unsigned payloads (mock only; never use this
 *   provider in a public production deployment) but still validates the shape.
 */
import { ApiError } from "../../errors.ts";
import { newId } from "../../utils/ids.ts";
import {
  isRecord,
  parsePixJson,
  type PixCreatePayoutInput,
  type PixPayoutResult,
  type PixPayoutStatus,
  type PixPayoutStatusResult,
  type PixProvider,
  type PixWebhookEvent,
  type PixWebhookHeaders,
} from "./types.ts";

const STATUSES = new Map<string, PixPayoutStatus>();

const FAILED_EVENTS = new Set(["TRANSFER_FAILED", "TRANSFER_CANCELLED", "TRANSFER_CANCELED", "TRANSFER_REJECTED"]);

export class MockPixProvider implements PixProvider {
  readonly name = "mock" as const;

  async createPayout(input: PixCreatePayoutInput): Promise<PixPayoutResult> {
    const providerPayoutId = newId("mock_pix");
    if (input.pixKey.trim().toLowerCase().endsWith("@fail.test")) {
      STATUSES.set(providerPayoutId, "failed");
      return {
        providerPayoutId,
        status: "failed",
        failureReason: "Falha simulada do provedor mock (chave @fail.test)",
      };
    }
    STATUSES.set(providerPayoutId, "pending");
    return { providerPayoutId, status: "pending" };
  }

  async getPayoutStatus(providerPayoutId: string): Promise<PixPayoutStatusResult> {
    return { status: STATUSES.get(providerPayoutId) ?? "pending" };
  }

  verifyWebhook(_headers: PixWebhookHeaders, rawBody: Buffer): PixWebhookEvent {
    const payload = parsePixJson(rawBody);
    if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.event !== "string") {
      throw new ApiError("VALIDATION_ERROR", "Evento de webhook mock inválido", 400);
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
    if (normalized === "TRANSFER_PAID") status = "paid";
    else if (FAILED_EVENTS.has(normalized)) status = "failed";

    if (providerPayoutId && status !== "ignored") STATUSES.set(providerPayoutId, status);

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
