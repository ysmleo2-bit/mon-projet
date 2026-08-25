/**
 * Layout protégé — s'exécute côté serveur (Node.js, pas Edge)
 * Vérifie le cookie cc_session et redirige vers /login si invalide.
 * Aucune dépendance Edge — fonctionne même si le middleware est inactif.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth-edge";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token       = cookieStore.get("cc_session")?.value;
  const session     = token ? await verifyToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
