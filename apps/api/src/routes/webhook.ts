import type { RequestHandler } from "express";
import { handleStripeWebhook } from "../services/payments.ts";
import { handlePixWebhook } from "../services/payout-webhook.ts";

/** Mounted before express.json() so the raw body is available for signature checks. */
export const stripeWebhookHandler: RequestHandler = (req, res, next) => {
  try {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "");
    const result = handleStripeWebhook(raw, req.header("stripe-signature"));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PIX webhooks also need the raw body: Asaas authenticates with a shared
 * token header, and mock (dev/test) validates the payload shape.
 */
export const pixWebhookHandler: RequestHandler = (req, res, next) => {
  try {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "");
    const result = handlePixWebhook(req.headers, raw);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
