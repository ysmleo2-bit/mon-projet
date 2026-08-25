/**
 * GET /api/auth/me
 * Retourne l'utilisateur courant depuis le cookie de session
 * Vérifie également que le compte est toujours actif en DB
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetUserById } from "@/lib/db-users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Le middleware injecte déjà X-User-Id si authentifié
  const userId = req.headers.get("x-user-id");
  const role   = req.headers.get("x-user-role");
  const email  = req.headers.get("x-user-email");
  const name   = req.headers.get("x-user-name");

  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifier que le compte est toujours actif en DB
  const user = await dbGetUserById(userId).catch(() => null);
  if (!user || !user.active) {
    return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
  }

  return NextResponse.json({
    user: {
      id:    userId,
      email: email ?? user.email,
      name:  name  ?? user.name,
      role:  role  ?? user.role,
    },
  });
}
