/**
 * PIX provider webhooks.
 *
 * Order of operations:
 *   1. verify the provider token/signature against the raw body;
 *   2. dedupe by provider event id via `webhook_events` (UNIQUE id);
 *   3. resolve the payout by provider payout id (or externalReference);
 *   4. settle it idempotently (paid → paid_at, failed → refund once).
 *
 * Processing errors remove the dedupe row so the provider can retry.
 */
import { run } from "../db/index.ts";
import { logger } from "../logger.ts";
import { nowIso } from "../utils/time.ts";
import { getPixProvider } from "./pix/index.ts";
import type { PixWebhookHeaders } from "./pix/types.ts";
import {
  applyPayoutPaid,
  failPayoutWithRefund,
  findPayoutById,
  findPayoutByProviderPayoutId,
} from "./payouts.ts";

export interface PixWebhookResult {
  received: true;
  duplicate?: boolean;
  ignored?: boolean;
  type?: string;
  payoutId?: string;
  status?: string;
}

export function handlePixWebhook(headers: PixWebhookHeaders, rawBody: Buffer): PixWebhookResult {
  const provider = getPixProvider();
  const event = provider.verifyWebhook(headers, rawBody);
  const now = nowIso();
  const rawJson = rawBody.toString("utf8");

  const inserted = run(
    `INSERT INTO webhook_events (id, provider, type, payload_json, response_json, status, processed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, 'processing', ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [event.id, provider.name, event.type, rawJson, now, now],
  );
  if (inserted.changes === 0) {
    return { received: true, duplicate: true, type: event.type };
  }

  const ignore = (reason: string, payoutId?: string): PixWebhookResult => {
    run(
      "UPDATE webhook_events SET status = 'ignored', response_json = ?, processed_at = ? WHERE id = ?",
      [JSON.stringify({ reason, payoutId: payoutId ?? null }), nowIso(), event.id],
    );
    logger.warn("pix webhook ignored", { eventId: event.id, type: event.type, reason, payoutId });
    return { received: true, ignored: true, type: event.type };
  };

  try {
    if (event.status === "ignored") {
      return ignore("evento sem transição de status");
    }

    let payout = findPayoutByProviderPayoutId(provider.name, event.providerPayoutId);
    if (!payout && event.payoutId) {
      payout = findPayoutById(event.payoutId);
      if (payout && payout.provider !== provider.name) {
        return ignore("externalReference pertence a outro provedor", payout.id);
      }
    }
    if (!payout) {
      return ignore("saque não encontrado para o id do provedor");
    }

    let settledStatus = payout.status;

    if (event.status === "paid") {
      if (payout.status === "pending") {
        settledStatus = applyPayoutPaid(payout.id, event.providerPayoutId).status;
      } else {
        return ignore(`saque já está ${payout.status}; TRANSFER_PAID não aplicado`, payout.id);
      }
    } else if (event.status === "failed") {
      if (payout.status === "pending") {
        settledStatus = failPayoutWithRefund(
          payout.id,
          event.failureReason ?? "Transferência PIX falhou no provedor",
          "webhook",
        ).status;
      } else {
        return ignore(`saque já está ${payout.status}; TRANSFER_FAILED não aplicado`, payout.id);
      }
    }

    run(
      "UPDATE webhook_events SET status = 'processed', response_json = ?, processed_at = ? WHERE id = ?",
      [JSON.stringify({ payoutId: payout.id, status: settledStatus }), nowIso(), event.id],
    );
    return { received: true, type: event.type, payoutId: payout.id, status: settledStatus };
  } catch (error) {
    // Forget the event so the provider retries it.
    run("DELETE FROM webhook_events WHERE id = ?", [event.id]);
    throw error;
  }
}
