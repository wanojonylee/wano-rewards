/** JWT access tokens + route guards. */
import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { env } from "../env.ts";
import { ApiError } from "../errors.ts";
import { get } from "../db/index.ts";
import type { Role, UserRow } from "../types.ts";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  typ: "access";
}

export function signAccessToken(user: Pick<UserRow, "id" | "role">): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role, typ: "access" };
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.jwtExpiresInDays}d`,
    issuer: "recio-api",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"], issuer: "recio-api" });
    if (typeof decoded === "string" || decoded.typ !== "access" || typeof decoded.sub !== "string") {
      throw new Error("invalid token payload");
    }
    return { sub: decoded.sub, role: decoded.role as Role, typ: "access" };
  } catch {
    throw ApiError.unauthorized("Token inválido ou expirado");
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/** Resolves the bearer token to a live, non-deleted user. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    next(ApiError.unauthorized());
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = get<UserRow>("SELECT * FROM users WHERE id = ?", [payload.sub]);
    if (!user || user.deleted_at) {
      next(ApiError.unauthorized("Conta indisponível"));
      return;
    }
    req.auth = { userId: user.id, role: user.role, user };
    next();
  } catch (error) {
    next(error);
  }
};

/** Like `authenticate`, but tolerates anonymous requests. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = get<UserRow>("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [payload.sub]);
    if (user) req.auth = { userId: user.id, role: user.role, user };
  } catch {
    // invalid token on an optional route is treated as anonymous
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(ApiError.forbidden("Permissão insuficiente"));
      return;
    }
    next();
  };
}

export function requireUserId(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.userId;
}
