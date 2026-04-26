import Navbar from "@/components/Navbar";
import LiveTicker from "@/components/LiveTicker";
import FeedClient from "@/components/FeedClient";
import type { GlitchDeal } from "@/lib/types";

async function getDeals(): Promise<GlitchDeal[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res  = await fetch(`${base}/api/deals`, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.deals ?? [];
  } catch {
    return [];
  }
}

export default async function FeedPage() {
  const deals = await getDeals();

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

        <FeedClient deals={deals} />
      </div>
    </div>
  );
}
