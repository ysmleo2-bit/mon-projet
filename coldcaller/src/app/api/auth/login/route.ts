/**
 * POST /api/auth/login
 * Body: { email: string; password: string }
 * Retour: { user: PublicUser } + cookie cc_session
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetUserByEmail, dbGetAllUsers, dbCreateUser } from "@/lib/db-users";
import { signToken, verifyPassword, hashPassword, cookieOptions, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Vérification AUTH_SECRET avant tout
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return NextResponse.json(
      { error: "Configuration manquante : ajoutez AUTH_SECRET dans les variables d'environnement Vercel (min 32 caractères)." },
      { status: 500 }
    );
  }

  const { email, password } = await req.json() as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }

  // Vérifier si c'est le premier lancement (aucun utilisateur = créer le compte admin)
  const allUsers = await dbGetAllUsers().catch(() => []);

  if (allUsers.length === 0) {
    // Premier lancement : créer automatiquement le compte admin avec ces credentials
    try {
      const hash  = await hashPassword(password);
      const admin = await dbCreateUser({
        email,
        name:          email.split("@")[0] ?? "Admin",
        role:          "admin",
        password_hash: hash,
      });
      const token = await signToken({
        userId: admin.id,
        email:  admin.email,
        name:   admin.name,
        role:   admin.role,
      });
      const res = NextResponse.json({ user: admin, firstLogin: true });
      res.cookies.set(COOKIE_NAME, token, cookieOptions);
      return res;
    } catch (err) {
      console.error("[auth/login] first-login error:", err);
      return NextResponse.json({ error: "Erreur lors de la création du compte admin." }, { status: 500 });
    }
  }

  // Authentification normale
  try {
    const user = await dbGetUserByEmail(email);

    if (!user) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: "Ce compte est désactivé" }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
    });

    const { password_hash: _, ...publicUser } = user;
    const res = NextResponse.json({ user: publicUser });
    res.cookies.set(COOKIE_NAME, token, cookieOptions);
    return res;
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json({ error: "Erreur serveur lors de la connexion." }, { status: 500 });
  }
}
