import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "./env";

export type AccessTokenPayload = {
  sub: string;
  role: "USER" | "DRIVER" | "ADMIN";
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  });
}

export function verifyAccessToken(token: string):
  | { ok: true; payload: AccessTokenPayload }
  | { ok: false; error: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    if (!decoded?.sub || !decoded?.role) {
      return { ok: false, error: "Invalid token payload" };
    }
    return { ok: true, payload: decoded };
  } catch {
    return { ok: false, error: "Invalid or expired token" };
  }
}
