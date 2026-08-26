"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus,
  Users, Phone, CalendarCheck, RotateCcw, Target,
  ChevronDown, Loader2, RefreshCw,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SdrStats {
  sdr_id:              string;
  sdr_name:            string;
  leads_count:         number;
  calls_total:         number;
  r1_count:            number;
  relances_count:      number;
  decroches_count:     number;
  pas_decroches_count: number;
  booking_rate:        number;
  prev_calls_change:   number | null;
  prev_r1_change:      number | null;
}
interface Totals {
  total_leads:    number;
  total_calls:    number;
  total_r1:       number;
  total_relances: number;
  booking_rate:   number;
}
interface ChartPoint {
  day:       string;
  calls_sum: number;
  r1_sum:    number;
}
interface PerfData {
  sdrs:    SdrStats[];
  totals:  Totals;
  chart:   ChartPoint[];
  period:  { start: string; end: string };
}

interface PublicUser { id: string; name: string; role: string; active: boolean }

// ── Constantes ────────────────────────────────────────────────────────────────
const PERIODS = [
  { id: "today", label: "Aujourd'hui"      },
  { id: "week",  label: "Cette semaine"    },
  { id: "month", label: "Ce mois"          },
];

// ── Mini SVG bar chart ────────────────────────────────────────────────────────
function MiniBarChart({ data, color }: { data: { day: string; value: number }[]; color: string }) {
  if (!data.length) return <div className="h-16 flex items-center justify-center text-xs text-gray-400">Aucune donnée</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.value}`}>
          <div
            className={cn("w-full rounded-sm transition-all", color)}
            style={{ height: `${Math.max(2, (d.value / max) * 56)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (pct === 0)    return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0%</span>;
  const up = pct > 0;
  return (
    <span className={cn("text-xs flex items-center gap-0.5 font-medium", up ? "text-emerald-600" : "text-red-500")}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: React.ReactNode; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [period,       setPeriod]       = useState("month");
  const [selectedSdr,  setSelectedSdr]  = useState("all");
  const [data,         setData]         = useState<PerfData | null>(null);
  const [users,        setUsers]        = useState<PublicUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [customFrom,   setCustomFrom]   = useState("");
  const [customTo,     setCustomTo]     = useState("");
  const [showCustom,   setShowCustom]   = useState(false);

  // Charger les utilisateurs pour le filtre SDR
  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((d: { users: PublicUser[] }) => setUsers(d.users?.filter((u) => u.active) ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ period });
      if (period === "custom" && customFrom && customTo) {
        p.set("from", customFrom); p.set("to", customTo);
      }
      if (selectedSdr !== "all") p.set("userId", selectedSdr);
      const res  = await fetch(`/api/performance?${p}`);
      const json = await res.json() as PerfData;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period, selectedSdr, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const chartCallsData = (data?.chart ?? []).map((c) => ({ day: c.day, value: c.calls_sum }));
  const chartR1Data    = (data?.chart ?? []).map((c) => ({ day: c.day, value: c.r1_sum }));

  return (
    <div className="flex h-screen bg-gray-50">
      <Navbar variant="app" />

      <main className="flex-1 overflow-y-auto">
        {/* En-tête */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Performance équipe</h1>
              <p className="text-sm text-gray-500 mt-0.5">Statistiques calculées automatiquement depuis le CRM</p>
            </div>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Actualiser
            </button>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {/* Période */}
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => { setPeriod(p.id); setShowCustom(false); }}
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    period === p.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => { setPeriod("custom"); setShowCustom(true); }}
                className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  period === "custom" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                Personnalisé
              </button>
            </div>

            {showCustom && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            )}

            {/* SDR filter */}
            <div className="relative">
              <select value={selectedSdr} onChange={(e) => setSelectedSdr(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="all">Toute l'équipe</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-gray-500">Erreur de chargement</div>
          ) : (
            <>
              {/* ── Totaux équipe ─────────────────────────────────────────────── */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Vue globale équipe</h2>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatTile label="Leads attribués" value={data.totals.total_leads}
                    icon={Target} color="bg-violet-500" />
                  <StatTile label="Appels passés" value={data.totals.total_calls}
                    icon={Phone} color="bg-blue-500" />
                  <StatTile label="Relances" value={data.totals.total_relances}
                    icon={RotateCcw} color="bg-amber-500" />
                  <StatTile label="R1 bookés" value={data.totals.total_r1}
                    icon={CalendarCheck} color="bg-emerald-500" />
                  <StatTile label="Taux de booking" value={`${data.totals.booking_rate}%`}
                    icon={TrendingUp} color="bg-brand-600" />
                </div>
              </section>

              {/* ── Graphiques activité ───────────────────────────────────────── */}
              {data.chart.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Activité par jour</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <p className="text-sm font-medium text-gray-700 mb-4">Appels passés</p>
                      <MiniBarChart data={chartCallsData} color="bg-blue-400" />
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-gray-400">{chartCallsData[0]?.day ?? ""}</span>
                        <span className="text-[10px] text-gray-400">{chartCallsData[chartCallsData.length - 1]?.day ?? ""}</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <p className="text-sm font-medium text-gray-700 mb-4">R1 bookés par jour</p>
                      <MiniBarChart data={chartR1Data} color="bg-emerald-400" />
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-gray-400">{chartR1Data[0]?.day ?? ""}</span>
                        <span className="text-[10px] text-gray-400">{chartR1Data[chartR1Data.length - 1]?.day ?? ""}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Tableau SDR ───────────────────────────────────────────────── */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Détail par SDR ({data.sdrs.length})
                </h2>
                {data.sdrs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Aucune activité sur cette période</p>
                    <p className="text-gray-400 text-xs mt-1">Les statistiques apparaissent dès qu'un lead est mis à jour</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SDR</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leads</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Appels</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Décrochés</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Relances</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">R1 bookés</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.sdrs.map((sdr, i) => (
                            <tr key={sdr.sdr_id} className={cn("hover:bg-gray-50 transition-colors", i === 0 && "bg-brand-50/30")}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">
                                    {sdr.sdr_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-gray-900">{sdr.sdr_name}</span>
                                  {i === 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">🏆 Top</span>}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right font-medium text-gray-900">{sdr.leads_count}</td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-medium text-gray-900">{sdr.calls_total}</span>
                                  <Trend pct={sdr.prev_calls_change} />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right text-gray-600">{sdr.decroches_count}</td>
                              <td className="px-4 py-4 text-right text-amber-700 font-medium">{sdr.relances_count}</td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-medium text-emerald-700">{sdr.r1_count}</span>
                                  <Trend pct={sdr.prev_r1_change} />
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span className={cn(
                                  "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold",
                                  sdr.booking_rate >= 20 ? "bg-emerald-100 text-emerald-700" :
                                  sdr.booking_rate >= 10 ? "bg-amber-100 text-amber-700" :
                                  "bg-gray-100 text-gray-600"
                                )}>
                                  {sdr.booking_rate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Note méthodologique ──────────────────────────────────────── */}
              <p className="text-xs text-gray-400 text-center">
                Les statistiques sont calculées depuis les leads actifs du CRM. Les appels correspondent au champ <code className="font-mono">callCount</code> de chaque lead.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
