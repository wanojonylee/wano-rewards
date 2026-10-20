/** Route helpers. */
import type { Request } from "express";
import { ApiError } from "../errors.ts";
import type { UserRow } from "../types.ts";

export function authUser(req: Request): UserRow {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.user;
}

export function idempotencyKey(req: Request): string | undefined {
  return req.header("idempotency-key") ?? undefined;
}

export function clientIp(req: Request): string | undefined {
  return req.ip;
}

export function headerValue(req: Request, name: string): string | undefined {
  return req.header(name) ?? undefined;
}
