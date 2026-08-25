/**
 * auth.ts — utilitaires d'authentification
 *
 * • JWT signé HS256 via `jose` (Edge-compatible → utilisable dans middleware.ts)
 * • Hashing bcryptjs (Node.js uniquement — pas dans middleware)
 * • Cookie HTTP-only "cc_session"
 *
 * Env var requise : AUTH_SECRET (min 32 chars, random)
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
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (min 32 caractères)");
  }
  return new TextEncoder().encode(secret);
}

// ── JWT ───────────────────────────────────────────────────────────────────────
export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ── Password (Node.js uniquement, pas Edge) ───────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(plain, hash);
}

// ── Cookie options ────────────────────────────────────────────────────────────
export const cookieOptions = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === "production",
  sameSite:  "strict" as const,
  path:      "/",
  maxAge:    60 * 60 * 24 * 7,  // 7 jours en secondes
};
