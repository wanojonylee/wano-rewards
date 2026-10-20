/** Request id, access logging and body/query validation. */
import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ApiError } from "../errors.ts";
import { logger } from "../logger.ts";
import { uuid } from "../utils/ids.ts";

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  req.id = incoming && incoming.length <= 100 ? incoming : uuid();
  res.setHeader("x-request-id", req.id);
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info("http", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.auth?.userId,
    });
  });
  next();
};

function formatZodError(error: ZodError): ApiError {
  const details = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
  return new ApiError("VALIDATION_ERROR", "Dados inválidos", 400, { issues: details });
}

export function parseWith<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw formatZodError(result.error);
  return result.data;
}

export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = parseWith(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    try {
      parseWith(schema, req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    try {
      parseWith(schema, req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}
