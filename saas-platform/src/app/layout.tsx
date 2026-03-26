import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SetterLink — Connectez Setters & Entrepreneurs",
  description: "La plateforme qui met en relation les setters et les entrepreneurs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
