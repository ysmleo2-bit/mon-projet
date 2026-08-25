/**
 * auth-server.ts — utilitaires côté API routes (Node.js, pas Edge)
 *
 * Lit les headers injectés par le middleware (x-user-id, x-user-role, etc.)
 * et fournit des helpers de contrôle d'accès pour les routes API.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";

/**
 * Extrait l'utilisateur courant depuis les headers injectés par le middleware.
 * Retourne null si les headers sont absents (ne devrait pas arriver en prod).
 */
export function getRequestUser(req: NextRequest): AuthUser | null {
  const userId = req.headers.get("x-user-id");
  const role   = req.headers.get("x-user-role") as AuthUser["role"] | null;
  const email  = req.headers.get("x-user-email");
  const name   = req.headers.get("x-user-name");

  if (!userId || !role || !email) return null;

  return { userId, role, email, name: name ?? "" };
}

/**
 * Vérifie que la requête est authentifiée.
 * Retourne { user } ou une NextResponse 401 à renvoyer immédiatement.
 */
export function requireAuth(req: NextRequest):
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse }
{
  const user = getRequestUser(req);
  if (!user) {
    return {
      user:  null,
      error: NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHENTICATED" },
        { status: 401 }
      ),
    };
  }
  return { user, error: null };
}

/**
 * Vérifie que l'utilisateur est admin.
 */
export function requireAdmin(req: NextRequest):
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse }
{
  const { user, error } = requireAuth(req);
  if (error) return { user: null, error };
  if (user!.role !== "admin") {
    return {
      user:  null,
      error: NextResponse.json(
        { error: "Accès interdit", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }
  return { user: user!, error: null };
}

/**
 * Filtre SQL user_id pour les requêtes DB.
 * Admin → pas de filtre (voit tout)
 * SDR   → WHERE user_id = $N
 */
export function userIdFilter(
  user: AuthUser,
  existingParams: unknown[],
): { condition: string; params: unknown[] } {
  if (user.role === "admin") {
    return { condition: "", params: existingParams };
  }
  const params = [...existingParams, user.userId];
  return {
    condition: `user_id = $${params.length}`,
    params,
  };
}
