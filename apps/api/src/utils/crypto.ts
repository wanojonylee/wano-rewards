/** Hashing + PII masking helpers. */
import { createHash, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison for hashed secrets. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hides most of a Pix key while keeping it recognisable. */
export function maskPixKey(key: string, type: string): string {
  const trimmed = key.trim();
  if (type === "email") {
    const [local = "", domain = ""] = trimmed.split("@");
    const visible = local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
  }
  if (type === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length <= 4) return "****";
    return `+${digits.slice(0, 2)} ${"*".repeat(digits.length - 6)}${digits.slice(-4)}`;
  }
  if (type === "cpf" || type === "cnpj") {
    const digits = trimmed.replace(/\D/g, "");
    return `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
  }
  // Random key (EVP) or unknown: keep a short tail.
  return trimmed.length <= 6 ? "****" : `${trimmed.slice(0, 4)}${"*".repeat(6)}${trimmed.slice(-2)}`;
}
