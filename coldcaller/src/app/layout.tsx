import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ColdCaller — Prospection B2B automatisée",
  description: "Scrape Google Maps, trouve 500 prospects avec numéros de téléphone en 10 minutes. CRM de démarchage intégré.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
