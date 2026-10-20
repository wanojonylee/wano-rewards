/** ID + token helpers. */
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { customAlphabet } from "nanoid";

// Crockford-ish base32 without ambiguous characters (0/O, 1/I).
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const shortId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 14);
const redemptionId = customAlphabet(CODE_ALPHABET, 8);

/** Public ids are prefixed so they are recognisable in logs and URLs. */
export function newId(prefix: string): string {
  return `${prefix}_${shortId()}`;
}

export function uuid(): string {
  return randomUUID();
}

/** 8-char base32 redemption code, e.g. "K7M2QX9P". */
export function newRedemptionCode(): string {
  return redemptionId();
}

/** 6-digit numeric code used by mini-market payments. */
export function newSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Opaque, URL-safe token (refresh tokens, session tokens). */
export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
