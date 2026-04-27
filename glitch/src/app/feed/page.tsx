export const revalidate = 900; // ISR : régénère toutes les 15 min

import Navbar from "@/components/Navbar";
import LiveTicker from "@/components/LiveTicker";
import FeedClient from "@/components/FeedClient";
import { fetchDeals } from "@/lib/fetch-deals";

export default async function FeedPage() {
  const deals = await fetchDeals();

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />
      <div className="pt-14">
        <LiveTicker />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-black mono text-white mb-1">
            Base de données GLITCH
          </h1>
          <p className="text-sm text-white/40">
            Données en temps réel · mises à jour toutes les 15 min
          </p>
        </div>

        <FeedClient initialDeals={deals} />
      </div>
    </div>
  );
}
