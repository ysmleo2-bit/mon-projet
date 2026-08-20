import type { Metadata } from "next";
import "./globals.css";
import SupportButton from "@/components/SupportButton";

export const metadata: Metadata = {
  title: "ColdCaller — Prospection B2B automatisée",
  description: "Scrape Google Maps, trouve 500 prospects avec numéros de téléphone en 10 minutes. CRM de démarchage intégré.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <SupportButton />
      </body>
    </html>
  );
}
