/**
 * Layout protégé — Server Component, vérifie le cookie directement.
 * Force-dynamic : jamais mis en cache, toujours re-vérifié à chaque requête.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth-edge";

export const dynamic = "force-dynamic";

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
