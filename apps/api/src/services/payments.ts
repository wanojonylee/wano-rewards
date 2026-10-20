/**
 * Payments: wallet top-up packs (Stripe Checkout or mock provider),
 * Stripe webhooks (idempotent by event id) and mini-market credit payments.
 *
 * Server-side pack pricing is authoritative — client amounts are ignored.
 */
import Stripe from "stripe";
import { env, stripeEnabled } from "../env.ts";
import { ApiError } from "../errors.ts";
import { get, run, withTransaction } from "../db/index.ts";
import { findPack, PACKS, type PackSpec } from "../config/economy.ts";
import { applyLedger, getWallet, type WalletView } from "./ledger.ts";
import { notify } from "./notifications.ts";
import { newId, newSixDigitCode } from "../utils/ids.ts";
import { nowIso } from "../utils/time.ts";
import { logger } from "../logger.ts";
import { requireMachineByCode } from "./machines.ts";
import { withIdempotencyAsync, type IdempotentResult } from "./idempotency.ts";
import type { PaymentRow, UserRow } from "../types.ts";

export interface PaymentView {
  id: string;
  kind: PaymentRow["kind"];
  status: PaymentRow["status"];
  provider: PaymentRow["provider"];
  amountCents: number;
  creditCents: number;
  bonusPoints: number;
  currency: string;
  checkoutUrl: string | null;
  code: string | null;
  createdAt: string;
  completedAt: string | null;
}

let client: Stripe | null = null;
let webhookClient: Stripe | null = null;

function stripeClient(): Stripe {
  if (!stripeEnabled()) {
    throw new ApiError("PAYMENT_NOT_COMPLETABLE", "Stripe não configurado", 503);
  }
  client ??= new Stripe(env.stripeSecretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

/**
 * Signature verification does not call the API, so it only needs a placeholder
 * key when no Stripe secret is configured (e.g. webhook-only deployments/tests).
 */
function stripeForWebhook(): Stripe {
  webhookClient ??= new Stripe(env.stripeSecretKey || "sk_test_webhook_verification_only", {
    maxNetworkRetries: 0,
    timeout: 10_000,
  });
  return webhookClient;
}

export function paymentView(row: PaymentRow): PaymentView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    provider: row.provider,
    amountCents: row.amount_cents,
    creditCents: row.credit_cents,
    bonusPoints: row.bonus_points,
    currency: row.currency,
    checkoutUrl: row.checkout_url,
    code: row.code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function listPacks(): { items: PackSpec[] } {
  return { items: PACKS };
}

export interface CheckoutInput {
  packId: string;
  successUrl: string;
  cancelUrl: string;
}

export function checkout(
  user: UserRow,
  input: CheckoutInput,
  idempotencyKey: string | undefined,
): Promise<IdempotentResult<{ payment: PaymentView; wallet: WalletView }>> {
  return withIdempotencyAsync({
    key: idempotencyKey,
    userId: user.id,
    endpoint: "payments:checkout",
    body: input,
    execute: async () => {
      const pack = findPack(input.packId);
      if (!pack) {
        throw ApiError.badRequest("VALIDATION_ERROR", "Pacote inválido", {
          packId: input.packId,
          available: PACKS.map((item) => item.id),
        });
      }

      const provider = stripeEnabled() ? "stripe" : "mock";
      const now = nowIso();
      const paymentId = newId("pay");
      const row: PaymentRow = {
        id: paymentId,
        user_id: user.id,
        kind: "topup",
        pack_id: pack.id,
        status: "requires_payment",
        provider,
        amount_cents: pack.priceCents,
        credit_cents: pack.creditCents,
        bonus_points: pack.bonusPoints,
        currency: "BRL",
        checkout_url: null,
        stripe_session_id: null,
        stripe_payment_intent_id: null,
        code: null,
        machine_id: null,
        metadata_json: null,
        created_at: now,
        completed_at: null,
        updated_at: now,
      };

      run(
        `INSERT INTO payments (id, user_id, kind, pack_id, status, provider, amount_cents, credit_cents,
           bonus_points, currency, checkout_url, stripe_session_id, stripe_payment_intent_id, code,
           machine_id, metadata_json, created_at, completed_at, updated_at)
         VALUES (?, ?, 'topup', ?, 'requires_payment', ?, ?, ?, ?, 'BRL', NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, ?)`,
        [
          row.id,
          row.user_id,
          row.pack_id,
          row.provider,
          row.amount_cents,
          row.credit_cents,
          row.bonus_points,
          now,
          now,
        ],
      );

      if (provider === "stripe") {
        try {
          const session = await stripeClient().checkout.sessions.create(
            {
              mode: "payment",
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: env.stripeCurrency,
                    unit_amount: pack.priceCents,
                    product_data: {
                      name: `RecIO ${pack.label} de crédito`,
                      description: `${(pack.creditCents / 100).toFixed(2)} de saldo + ${pack.bonusPoints} pontos bônus`,
                    },
                  },
                },
              ],
              success_url: input.successUrl,
              cancel_url: input.cancelUrl,
              client_reference_id: row.id,
              metadata: { paymentId: row.id, userId: user.id, packId: pack.id },
            },
            { idempotencyKey: `checkout-${row.id}` },
          );
          if (!session.url) throw new Error("Stripe session sem URL");
          run(
            "UPDATE payments SET checkout_url = ?, stripe_session_id = ?, updated_at = ? WHERE id = ?",
            [session.url, session.id, nowIso(), row.id],
          );
          row.checkout_url = session.url;
          row.stripe_session_id = session.id;
        } catch (error) {
          logger.error("stripe checkout failed", {
            paymentId: row.id,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          throw new ApiError(
            "PAYMENT_NOT_COMPLETABLE",
            "Não foi possível iniciar o checkout. Tente novamente.",
            502,
          );
        }
      } else {
        row.checkout_url = `mock://checkout/${row.id}`;
        run("UPDATE payments SET checkout_url = ?, updated_at = ? WHERE id = ?", [
          row.checkout_url,
          nowIso(),
          row.id,
        ]);
      }

      return {
        status: 201,
        body: { payment: paymentView(row), wallet: getWallet(user.id) },
      };
    },
  });
}

export function getPayment(userId: string, paymentId: string): PaymentView {
  const row = get<PaymentRow>("SELECT * FROM payments WHERE id = ? AND user_id = ?", [paymentId, userId]);
  if (!row) throw ApiError.notFound("Pagamento não encontrado");
  return paymentView(row);
}

/** Credits a top-up exactly once (ledger idempotency key `payment:<id>`). */
function creditTopUp(paymentId: string, paymentIntentId?: string | null): PaymentRow {
  return withTransaction(() => {
    const payment = get<PaymentRow>("SELECT * FROM payments WHERE id = ?", [paymentId]);
    if (!payment) throw ApiError.notFound("Pagamento não encontrado");
    if (payment.status === "paid") return payment;

    const now = nowIso();
    applyLedger({
      userId: payment.user_id,
      pointsDelta: payment.bonus_points,
      creditDeltaCents: payment.credit_cents,
      withdrawableDeltaCents: 0, // top-up credit is not withdrawable
      type: "topup",
      refType: "payment",
      refId: payment.id,
      description: `Recarga ${payment.pack_id ?? ""} — R$ ${(payment.amount_cents / 100).toFixed(2).replace(".", ",")}`,
      idempotencyKey: `payment:${payment.id}`,
      createdAt: now,
    });

    run(
      `UPDATE payments SET status = 'paid', completed_at = ?, updated_at = ?,
         stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id) WHERE id = ?`,
      [now, now, paymentIntentId ?? null, payment.id],
    );
    notify({
      userId: payment.user_id,
      type: "topup_paid",
      title: "Recarga confirmada",
      body: `R$ ${(payment.credit_cents / 100).toFixed(2).replace(".", ",")} adicionados ao seu saldo e ${payment.bonus_points} pontos bônus.`,
      icon: "wallet",
      deepLink: "recio://wallet",
      createdAt: now,
    });
    return get<PaymentRow>("SELECT * FROM payments WHERE id = ?", [paymentId]) as PaymentRow;
  });
}

/** Mock provider completion — never available once real Stripe is configured. */
export function completeMockPayment(
  userId: string,
  paymentId: string,
): { payment: PaymentView; wallet: WalletView } {
  const payment = get<PaymentRow>("SELECT * FROM payments WHERE id = ? AND user_id = ?", [
    paymentId,
    userId,
  ]);
  if (!payment) throw ApiError.notFound("Pagamento não encontrado");
  if (payment.provider === "stripe" && stripeEnabled()) {
    throw new ApiError(
      "PAYMENT_NOT_COMPLETABLE",
      "Este pagamento usa Stripe real. Conclua pelo checkout.",
      403,
    );
  }
  if (payment.status === "refunded" || payment.status === "expired") {
    throw new ApiError("PAYMENT_NOT_COMPLETABLE", "Pagamento não pode ser concluído", 409, {
      status: payment.status,
    });
  }

  const updated = creditTopUp(payment.id);
  return { payment: paymentView(updated), wallet: getWallet(userId) };
}

/** Creates a mini-market payment: debits credit (never points) and returns a 6-digit code. */
export function miniMarketPayment(
  user: UserRow,
  machineCode: string,
  amountCents: number,
): { payment: PaymentView; wallet: WalletView } {
  const machine = requireMachineByCode(machineCode);
  const now = nowIso();

  return withTransaction(() => {
    const wallet = getWallet(user.id);
    if (wallet.creditCents < amountCents) {
      throw new ApiError("INSUFFICIENT_CREDIT", "Saldo insuficiente", 409, {
        balanceCents: wallet.creditCents,
        requiredCents: amountCents,
      });
    }
    const paymentId = newId("pay");
    const code = newSixDigitCode();
    // Withdrawable credit is consumed first; top-up credit covers the remainder.
    const withdrawableDelta = -Math.min(amountCents, wallet.withdrawableCents);

    applyLedger({
      userId: user.id,
      creditDeltaCents: -amountCents,
      withdrawableDeltaCents: withdrawableDelta,
      type: "mini_market",
      refType: "payment",
      refId: paymentId,
      description: `Mini-market — ${machine.name}`,
      idempotencyKey: `mini:${paymentId}`,
      createdAt: now,
    });

    run(
      `INSERT INTO payments (id, user_id, kind, pack_id, status, provider, amount_cents, credit_cents,
         bonus_points, currency, checkout_url, stripe_session_id, stripe_payment_intent_id, code,
         machine_id, metadata_json, created_at, completed_at, updated_at)
       VALUES (?, ?, 'mini_market', NULL, 'paid', 'mock', ?, ?, 0, 'BRL', NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        user.id,
        amountCents,
        amountCents,
        code,
        machine.id,
        JSON.stringify({ partner: machine.name, machineCode: machine.code }),
        now,
        now,
        now,
      ],
    );

    notify({
      userId: user.id,
      type: "mini_market_paid",
      title: "Compra no mini-market",
      body: `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} debitados. Código ${code}.`,
      icon: "store",
      deepLink: "recio://wallet",
      createdAt: now,
    });

    const row = get<PaymentRow>("SELECT * FROM payments WHERE id = ?", [paymentId]) as PaymentRow;
    return { payment: paymentView(row), wallet: getWallet(user.id) };
  });
}

export interface WebhookResult {
  received: true;
  duplicate?: boolean;
  ignored?: boolean;
  type?: string;
}

/** Reverses a paid top-up on refund, clamping to available balances. */
function refundPayment(payment: PaymentRow): void {
  withTransaction(() => {
    const fresh = get<PaymentRow>("SELECT * FROM payments WHERE id = ?", [payment.id]);
    if (!fresh || fresh.status !== "paid") return;
    const wallet = getWallet(fresh.user_id);
    const creditReversal = Math.min(fresh.credit_cents, wallet.creditCents);
    const withdrawableReversal = Math.min(creditReversal, wallet.withdrawableCents);
    const pointsReversal = Math.min(fresh.bonus_points, wallet.points);
    const now = nowIso();

    if (creditReversal > 0 || pointsReversal > 0) {
      applyLedger({
        userId: fresh.user_id,
        pointsDelta: -pointsReversal,
        creditDeltaCents: -creditReversal,
        withdrawableDeltaCents: -withdrawableReversal,
        type: "refund",
        refType: "payment",
        refId: fresh.id,
        description: `Estorno da recarga ${fresh.pack_id ?? fresh.id}`,
        idempotencyKey: `refund:${fresh.id}`,
        createdAt: now,
      });
    }
    run("UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?", [now, fresh.id]);
    notify({
      userId: fresh.user_id,
      title: "Recarga estornada",
      body: "O valor da sua recarga foi estornado.",
      type: "topup_refunded",
      icon: "wallet",
      deepLink: "recio://wallet",
      createdAt: now,
    });
  });
}

export function handleStripeWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
  if (!env.stripeWebhookSecret) {
    logger.warn("stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured");
    return { received: true, ignored: true };
  }
  if (!signature) {
    throw new ApiError("INVALID_SIGNATURE", "Assinatura Stripe ausente", 400);
  }

  let event: Stripe.Event;
  try {
    event = stripeForWebhook().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    throw new ApiError("INVALID_SIGNATURE", "Assinatura Stripe inválida", 400);
  }

  const now = nowIso();
  const insert = run(
    `INSERT INTO webhook_events (id, provider, type, payload_json, response_json, status, processed_at, created_at)
     VALUES (?, 'stripe', ?, ?, NULL, 'processing', ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [event.id, event.type, JSON.stringify(event), now, now],
  );
  if (insert.changes === 0) {
    return { received: true, duplicate: true, type: event.type };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId ?? session.client_reference_id ?? null;
        const payment = paymentId
          ? get<PaymentRow>("SELECT * FROM payments WHERE id = ?", [paymentId])
          : get<PaymentRow>("SELECT * FROM payments WHERE stripe_session_id = ?", [session.id]);
        if (payment) {
          creditTopUp(
            payment.id,
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          );
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId ?? session.client_reference_id ?? null;
        if (paymentId) {
          run(
            "UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'requires_payment'",
            [now, paymentId],
          );
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        const payment = intent
          ? get<PaymentRow>("SELECT * FROM payments WHERE stripe_payment_intent_id = ?", [intent])
          : undefined;
        if (payment) refundPayment(payment);
        break;
      }
      default:
        run("UPDATE webhook_events SET status = 'ignored', processed_at = ? WHERE id = ?", [
          now,
          event.id,
        ]);
        return { received: true, ignored: true, type: event.type };
    }

    run("UPDATE webhook_events SET status = 'processed', processed_at = ? WHERE id = ?", [
      now,
      event.id,
    ]);
    return { received: true, type: event.type };
  } catch (error) {
    // Allow Stripe to retry by forgetting the event.
    run("DELETE FROM webhook_events WHERE id = ?", [event.id]);
    throw error;
  }
}
