/**
 * Page racine — redirige vers /login ou /dashboard selon l'auth
 * Server Component : vérifie le cookie directement, pas de dépendance middleware
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth-edge";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token       = cookieStore.get("cc_session")?.value;
  const session     = token ? await verifyToken(token) : null;

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
