/**
 * Typed API errors. Every rejected request is rendered as:
 *   { error: { code, message, details }, requestId }
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "MACHINE_UNAVAILABLE"
  | "MACHINE_FULL"
  | "SESSION_ALREADY_ACTIVE"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_EXPIRED"
  | "INSUFFICIENT_POINTS"
  | "INSUFFICIENT_CREDIT"
  | "OUT_OF_STOCK"
  | "REWARD_EXPIRED"
  | "DELIVERY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYOUT_TOO_SMALL"
  | "PAYOUT_TOO_LARGE"
  | "PAYOUT_DAILY_CAP"
  | "PAYOUT_INVALID_STATE"
  | "PAYOUT_PROVIDER_UNAVAILABLE"
  | "PAYMENT_NOT_COMPLETABLE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_SIGNATURE"
  | "REFERRAL_INVALID"
  | "REFERRAL_ALREADY_APPLIED"
  | "DUPLICATE_RESOURCE";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown): ApiError {
    return new ApiError(code, message, 400, details);
  }

  static unauthorized(message = "Autenticação necessária", code: ErrorCode = "UNAUTHENTICATED"): ApiError {
    return new ApiError(code, message, 401);
  }

  static forbidden(message = "Acesso negado"): ApiError {
    return new ApiError("FORBIDDEN", message, 403);
  }

  static notFound(message = "Recurso não encontrado"): ApiError {
    return new ApiError("NOT_FOUND", message, 404);
  }

  static conflict(code: ErrorCode, message: string, details?: unknown): ApiError {
    return new ApiError(code, message, 409, details);
  }

  static tooLarge(message = "Requisição muito grande"): ApiError {
    return new ApiError("PAYLOAD_TOO_LARGE", message, 413);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
