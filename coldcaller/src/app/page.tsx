import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const jar   = await cookies();
  const token = jar.get("cc_session")?.value ?? "";

  if (token && token.length >= 10) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
