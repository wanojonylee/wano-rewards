/** Machine-facing deposit ingestion (server-to-server, X-Machine-Key). */
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.ts";
import { ApiError } from "../errors.ts";
import { findMachineByApiKey } from "../services/machines.ts";
import { ingestDeposits, type IngestItem, type IngestPayload } from "../services/sessions.ts";
import { materialSchema } from "../validators.ts";
import { headerValue } from "./helpers.ts";

const router = Router();

const ingestSchema = z.object({
  machineCode: z.string().trim().min(3).max(40),
  sessionToken: z.string().min(10).max(200),
  eventId: z.string().min(8).max(80),
  occurredAt: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        gtin: z.string().min(6).max(20).nullish(),
        material: materialSchema,
        weightGrams: z.number().int().min(0).max(100_000),
        accepted: z.boolean(),
        rejectReason: z.string().max(80).nullish(),
        skuName: z.string().max(160).nullish(),
        brand: z.string().max(80).nullish(),
      }),
    )
    .min(1)
    .max(100),
});

router.post("/ingest/deposits", (req, res, next) => {
  try {
    const apiKey = headerValue(req, "x-machine-key");
    if (!apiKey) throw ApiError.unauthorized("X-Machine-Key ausente");
    const machine = findMachineByApiKey(apiKey);
    if (!machine) throw ApiError.unauthorized("Chave de máquina inválida");
    res.locals.machine = machine;
    next();
  } catch (error) {
    next(error);
  }
}, validateBody(ingestSchema), (req, res) => {
  const machine = res.locals.machine as NonNullable<ReturnType<typeof findMachineByApiKey>>;
  const body = req.body as z.infer<typeof ingestSchema>;
  const payload: IngestPayload = {
    machineCode: body.machineCode,
    sessionToken: body.sessionToken,
    eventId: body.eventId,
    ...(body.occurredAt ? { occurredAt: body.occurredAt } : {}),
    items: body.items.map((item) => ({
      gtin: item.gtin ?? null,
      material: item.material as IngestItem["material"],
      weightGrams: item.weightGrams,
      accepted: item.accepted,
      rejectReason: item.rejectReason ?? null,
      skuName: item.skuName ?? null,
      brand: item.brand ?? null,
    })),
  };
  const result = ingestDeposits(machine, payload);
  res.status(result.duplicate ? 200 : 201).json(result);
});

export default router;
