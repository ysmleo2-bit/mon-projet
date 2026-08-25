/**
 * GET  /api/admin/users          → liste tous les utilisateurs
 * POST /api/admin/users          → crée un nouvel utilisateur (SDR ou admin)
 *
 * Protégé : role = admin uniquement (vérifié par middleware)
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetAllUsers, dbCreateUser, dbGetUserStats } from "@/lib/db-users";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (role !== "admin") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const users = await dbGetAllUsers();

  // Enrichir avec les stats (leads + prospects par user)
  const usersWithStats = await Promise.all(
    users.map(async (u) => {
      const stats = await dbGetUserStats(u.id).catch(() => ({ leads: 0, prospects: 0 }));
      return { ...u, stats };
    })
  );

  return NextResponse.json({ users: usersWithStats });
}

export async function POST(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (role !== "admin") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const { email, name, userRole = "sdr", password } = await req.json() as {
    email:     string;
    name:      string;
    userRole?: UserRole;
    password:  string;
  };

  if (!email || !name || !password) {
    return NextResponse.json({ error: "email, name et password requis" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères" }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  try {
    const user = await dbCreateUser({ email, name, role: userRole, password_hash });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    console.error("[admin/users POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
