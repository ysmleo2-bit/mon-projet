import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const jar   = await cookies();
  const token = jar.get("cc_session")?.value ?? "";

  // Vérification minimale : cookie présent et non vide
  if (!token || token.length < 10) {
    redirect("/login");
  }

  return <>{children}</>;
}
