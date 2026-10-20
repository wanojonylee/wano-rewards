/** Shared Zod schemas. */
import { z } from "zod";
import { MATERIAL_CODES } from "./config/economy.ts";

export const identifierSchema = z
  .string()
  .trim()
  .min(5)
  .max(120)
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    if (/^\+?[\d\s().-]{10,20}$/.test(value) && digits.length >= 10) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, "Informe um telefone ou e-mail válido");

export const paginationSchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const materialSchema = z.enum(MATERIAL_CODES as [string, ...string[]]);

export const idParamSchema = z.object({ id: z.string().min(2).max(80) });

export const codeParamSchema = z.object({ code: z.string().min(2).max(80) });

/** Accepts https URLs and app deep links (recio://...). */
export const redirectUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => /^(https?:\/\/|recio:\/\/)/i.test(value), "URL inválida");

export const deliverySchema = z.object({
  name: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(2),
  postalCode: z.string().trim().min(5).max(12),
});

export const localeSchema = z.enum(["pt-BR", "en"]);
