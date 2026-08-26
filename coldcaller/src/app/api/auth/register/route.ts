/**
 * POST /api/auth/register
 * Body: { name: string; email: string; password: string }
 * Crée un compte SDR (ou Admin si premier utilisateur)
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetAllUsers, dbGetUserByEmail, dbCreateUser } from "@/lib/db-users";
import { signToken, hashPassword, cookieOptions, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return NextResponse.json({ error: "Configuration serveur manquante (AUTH_SECRET)." }, { status: 500 });
  }

  const { name, email, password } = await req.json() as {
    name?: string; email?: string; password?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nom, email et mot de passe requis" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mot de passe trop court (min 6 caractères)" }, { status: 400 });
  }

  // Email déjà utilisé ?
  const existing = await dbGetUserByEmail(email).catch(() => null);
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  // Premier utilisateur → admin, sinon sdr
  const allUsers = await dbGetAllUsers().catch(() => []);
  const role     = allUsers.length === 0 ? "admin" : "sdr";

  const hash = await hashPassword(password);
  const user = await dbCreateUser({ email, name, role, password_hash: hash });

  const token = await signToken({
    userId: user.id,
    email:  user.email,
    name:   user.name,
    role:   user.role,
  });

  const res = NextResponse.json({ user, firstLogin: role === "admin" });
  res.cookies.set(COOKIE_NAME, token, cookieOptions);
  return res;
}
