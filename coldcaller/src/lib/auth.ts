/**
 * auth.ts — utilitaires d'authentification (Node.js runtime uniquement)
 *
 * • Re-exporte tout ce qui est Edge-safe depuis auth-edge.ts
 * • Ajoute hashPassword / verifyPassword (bcryptjs — Node.js only)
 *
 * NE PAS importer auth.ts depuis middleware.ts (risque Edge bundle).
 * Le middleware importe depuis auth-edge.ts directement.
 */

// ── Re-exports Edge-safe ──────────────────────────────────────────────────────
export type { UserRole, AuthUser, SessionPayload } from "@/lib/auth-edge";
export { COOKIE_NAME, SESSION_EXPIRY, signToken, verifyToken } from "@/lib/auth-edge";

// ── Bcrypt (Node.js uniquement) ───────────────────────────────────────────────
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
  maxAge:    60 * 60 * 24 * 7,  // 7 jours
};
