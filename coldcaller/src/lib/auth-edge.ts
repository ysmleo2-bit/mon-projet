/**
 * auth-edge.ts — JWT uniquement, compatible Edge Runtime
 * Importé UNIQUEMENT par src/middleware.ts (pas de Node.js crypto)
 * Ne jamais importer bcryptjs ici.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "sdr";

export interface AuthUser {
  userId: string;
  email:  string;
  name:   string;
  role:   UserRole;
}

export interface SessionPayload extends JWTPayload, AuthUser {}

// ── Constantes ────────────────────────────────────────────────────────────────
export const COOKIE_NAME    = "cc_session";
export const SESSION_EXPIRY = "7d";

// ── Clé secrète ───────────────────────────────────────────────────────────────
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) return new Uint8Array(32); // fallback → tokens invalides
  return new TextEncoder().encode(secret);
}

// ── JWT ───────────────────────────────────────────────────────────────────────
export async function signToken(user: AuthUser): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court (min 32 chars)");
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
