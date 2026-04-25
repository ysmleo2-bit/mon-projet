import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GLITCH — Fare Error Intelligence",
  description: "Détection automatique des erreurs tarifaires aériennes. Alertes Telegram instantanées. Économisez jusqu'à 90% sur vos vols.",
  keywords: ["erreur tarifaire", "fare error", "vol pas cher", "price glitch", "mistake fare"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-ink-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
