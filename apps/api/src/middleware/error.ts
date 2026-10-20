/** Central error + 404 handlers. */
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError, isApiError } from "../errors.ts";
import { logger } from "../logger.ts";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl.split("?")[0]}`));
};

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.id ?? "unknown";

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { issues: details } },
      requestId,
    });
    return;
  }

  const bodyError = error as BodyParserError;
  if (bodyError?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Requisição muito grande" },
      requestId,
    });
    return;
  }
  if (bodyError?.type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "JSON inválido" },
      requestId,
    });
    return;
  }

  if (isApiError(error)) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      requestId,
    });
    return;
  }

  logger.error("unhandled error", {
    requestId,
    path: req.originalUrl,
    error: error instanceof Error ? error : new Error(String(error)),
    stack: error instanceof Error ? error.stack : undefined,
  });
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    requestId,
  });
};
