import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AERIS — Premium Flight & Hotel Search",
  description:
    "Trouvez le meilleur vol réel, sans biais commercial. Moteur de recherche transparent, IA prédictive, score intelligent.",
  keywords: ["vols pas chers", "comparateur vols", "hôtels", "travel", "prix réels"],
  openGraph: {
    title: "AERIS — The Transparent Flight Platform",
    description: "Zéro sponsoring. Zéro manipulation. Juste le meilleur deal.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-sky-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
