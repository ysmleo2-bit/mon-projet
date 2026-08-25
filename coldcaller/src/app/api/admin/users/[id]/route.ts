/**
 * PATCH  /api/admin/users/[id]   → modifier nom, rôle, actif, mot de passe
 * DELETE /api/admin/users/[id]   → supprimer un utilisateur
 *
 * Protégé : role = admin uniquement
 */

import { NextRequest, NextResponse } from "next/server";
import { dbUpdateUser, dbDeleteUser } from "@/lib/db-users";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const role    = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json() as {
    name?:     string;
    userRole?: UserRole;
    active?:   boolean;
    password?: string;
  };

  // Sécurité : l'admin ne peut pas se désactiver lui-même
  if (body.active === false && id === adminId) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
  }

  const patch: Parameters<typeof dbUpdateUser>[1] = {};
  if (body.name     !== undefined) patch.name   = body.name;
  if (body.userRole !== undefined) patch.role   = body.userRole;
  if (body.active   !== undefined) patch.active = body.active;
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères" }, { status: 400 });
    }
    patch.password_hash = await hashPassword(body.password);
  }

  const user = await dbUpdateUser(id, patch);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const role    = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const { id } = params;

  // Sécurité : l'admin ne peut pas supprimer son propre compte
  if (id === adminId) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  const ok = await dbDeleteUser(id);
  if (!ok) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
