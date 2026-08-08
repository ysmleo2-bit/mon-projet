"use client";

import { useState, useCallback } from "react";
import {
  Search, MapPin, Phone, Globe, Download,
  Loader2, ChevronDown, Zap, Check, Database,
  X, Star, CheckSquare, Square, ChevronRight,
  Filter, ExternalLink,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { NICHES, CITIES } from "@/lib/mock-data";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clientGeocode, clientSearchOsm, clientSearchSirene } from "@/lib/search-client";

type SortKey = "phone" | "rating" | "reviews" | "name";

// ── Enrichissement téléphone depuis le site web ───────────────────────────────
async function enrichPhones(
  leadsToEnrich: { id: string; website: string }[],
  onFound: (id: string, phone: string) => void
) {
  // Par batch de 5 simultanés pour ne pas surcharger
  const BATCH = 5;
  for (let i = 0; i < leadsToEnrich.length; i += BATCH) {
    const batch = leadsToEnrich.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ({ id, website }) => {
        try {
          const res = await fetch("/api/enrich-phone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: website }),
          });
          const data = await res.json();
          if (data.phone) onFound(id, data.phone);
        } catch { /* silencieux */ }
      })
    );
  }
}

// ── Badge téléphone ───────────────────────────────────────────────────────────
function PhoneBadge({ phone }: { phone: string }) {
  if (!phone) {
    return <span className="text-[10px] text-white/25 italic">Pas de tél.</span>;
  }
  return <span className="font-mono text-brand-300 text-xs font-semibold">{phone}</span>;
}

// ── Bouton recherche téléphone ────────────────────────────────────────────────
function PhoneLookupBtn({ name, city }: { name: string; city: string }) {
  const pjUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(name)}&ou=${encodeURIComponent(city)}`;
  const gUrl  = `https://www.google.fr/search?q=${encodeURIComponent(`"${name}" ${city} téléphone`)}`;
  return (
    <div className="flex items-center gap-1">
      <a
        href={pjUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Chercher sur Pages Jaunes"
        className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-300 border border-amber-400/20 hover:border-amber-400/40 rounded px-1.5 py-0.5 transition-all"
      >
        <ExternalLink className="w-2.5 h-2.5" /> PJ
      </a>
      <a
        href={gUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Chercher sur Google"
        className="flex items-center gap-1 text-[10px] text-blue-400/60 hover:text-blue-300 border border-blue-400/20 hover:border-blue-400/40 rounded px-1.5 py-0.5 transition-all"
      >
        <Search className="w-2.5 h-2.5" /> G
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [niche,      setNiche]      = useState("Plombier");
  const [city,       setCity]       = useState("Lyon");
  const [radius,     setRadius]     = useState(20);
  const [minRating,  setMinRating]  = useState(0);
  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [sortBy,     setSortBy]     = useState<SortKey>("phone");
  const [stats,      setStats]      = useState<{ osm: number; sirene: number; withPhone: number } | null>(null);
  const [showOnlyPhone,  setShowOnlyPhone]  = useState(false);
  const [enriching,      setEnriching]      = useState(false);
  const [enrichedCount,  setEnrichedCount]  = useState(0);

  // ── Sélection multiple ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingBulk,  setAddingBulk]  = useState(false);
  const [bulkAdded,   setBulkAdded]   = useState(false);

  // ── Panneau de détail ─────────────────────────────────────────────────────
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Recherche 100 % navigateur — aucun timeout Vercel possible ────────────
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    setBulkAdded(false);
    setDetailLead(null);
    setStats(null);
    setError(null);
    setProgress(10);
    setEnriching(false);
    setEnrichedCount(0);

    const interval = setInterval(() => setProgress((p) => Math.min(p + 4, 82)), 300);

    try {
      // 1. Géocodage — api-adresse.data.gouv.fr (CORS natif, API officielle FR)
      const geo = await clientGeocode(city);
      if (!geo) {
        setError(`Ville introuvable : "${city}". Essaie une autre ville.`);
        return;
      }
      setProgress(25);

      // 2. Annuaire des Entreprises + OpenStreetMap en parallèle (CORS *)
      const [sireneLeads, osmLeads] = await Promise.all([
        clientSearchSirene(niche, geo.dept, geo.lat, geo.lon, radius),
        clientSearchOsm(geo.lat, geo.lon, radius * 1000, niche, city),
      ]);
      setProgress(95);

      // 3. Fusionner — OSM en priorité (a les téléphones)
      const seen = new Map<string, Lead>();
      for (const l of osmLeads)    seen.set(l.id, l);
      for (const l of sireneLeads) if (!seen.has(l.id)) seen.set(l.id, l);

      const all      = Array.from(seen.values());
      const filtered = minRating > 0 ? all.filter((l) => l.rating >= minRating) : all;
      const withPhone = filtered.filter((l) => !!l.phone).length;

      setLeads(filtered);
      setStats({ osm: osmLeads.length, sirene: sireneLeads.length, withPhone });
      setProgress(100);
      setEnrichedCount(0);

      // 4. Sauvegarder en DB en arrière-plan
      if (filtered.length) {
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filtered),
        }).catch(() => {});
      }

      // 5. Enrichissement téléphone depuis sites web (en arrière-plan)
      const toEnrich = filtered.filter((l) => !l.phone && l.website);
      if (toEnrich.length > 0) {
        setEnriching(true);
        enrichPhones(
          toEnrich.map((l) => ({ id: l.id, website: l.website! })),
          (id, phone) => {
            setLeads((prev) =>
              prev.map((l) => l.id === id ? { ...l, phone } : l)
            );
            setStats((prev) =>
              prev ? { ...prev, withPhone: prev.withPhone + 1 } : prev
            );
            setEnrichedCount((n) => n + 1);
          }
        ).finally(() => setEnriching(false));
      }
    } catch (e) {
      console.error("Erreur recherche :", e);
      setError("Erreur lors de la recherche. Vérifiez votre connexion internet.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [niche, city, radius, minRating]);

  // ── Tri ───────────────────────────────────────────────────────────────────
  const sortedAndFiltered = [...leads]
    .filter((l) => !showOnlyPhone || !!l.phone)
    .sort((a, b) => {
      if (sortBy === "phone") {
        // Avec téléphone d'abord
        const hasA = !!a.phone ? 1 : 0;
        const hasB = !!b.phone ? 1 : 0;
        if (hasA !== hasB) return hasB - hasA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "rating")  return b.rating - a.rating;
      if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
      return a.name.localeCompare(b.name);
    });

  // ── Sélection ────────────────────────────────────────────────────────────
  const allSelected = sortedAndFiltered.length > 0 && selectedIds.size === sortedAndFiltered.length;

  function toggleOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedAndFiltered.map((l) => l.id)));
  }

  // ── Ajout bulk au CRM ────────────────────────────────────────────────────
  async function bulkAddToCrm() {
    const toAdd = sortedAndFiltered.filter((l) => selectedIds.has(l.id));
    if (!toAdd.length) return;
    setAddingBulk(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toAdd),
    });
    setLeads((prev) => prev.map((l) =>
      selectedIds.has(l.id) ? { ...l, _added: true } as Lead & { _added: boolean } : l
    ));
    setSelectedIds(new Set());
    setAddingBulk(false);
    setBulkAdded(true);
  }

  // ── Export CSV ───────────────────────────────────────────────────────────
  function exportCsv() {
    const header = "Nom,Catégorie,Téléphone,Adresse,Ville,Note,Avis,Site";
    const rows   = leads.map((l) =>
      `"${l.name}","${l.category}","${l.phone}","${l.address}","${l.city}",${l.rating},${l.reviewCount},"${l.website ?? ""}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `leads-${niche}-${city}.csv`; a.click();
  }

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      <Navbar />

      <main className="flex-1 flex overflow-hidden">
        {/* ── Colonne gauche : formulaire + résultats ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Top bar */}
          <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl px-5 h-14 flex items-center justify-between shrink-0">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-400" /> Recherche de leads
            </h1>
            {leads.length > 0 && (
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 text-xs btn-outline py-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV ({leads.length})
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-5">
            {/* Formulaire de recherche */}
            <div className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-sm font-bold text-white mb-1">Scraper des prospects</h2>
              <p className="text-xs text-white/35 mb-4">
                Sources : OpenStreetMap (avec tél.) + Annuaire des Entreprises · Leads sauvegardés dans ton CRM.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Secteur</label>
                  <div className="relative">
                    <select value={niche} onChange={(e) => setNiche(e.target.value)} className="select pr-8">
                      {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Ville</label>
                  <div className="relative">
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="select pr-8 w-full"
                    >
                      {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Rayon : {radius} km</label>
                  <input type="range" min={5} max={50} step={5} value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer h-1 mt-3" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Note min : {minRating > 0 ? `★ ${minRating}+` : "Toutes"}</label>
                  <input type="range" min={0} max={4} step={0.5} value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1 mt-3" />
                </div>
              </div>

              <button onClick={handleSearch} disabled={loading}
                className={cn("btn-primary flex items-center gap-2 text-sm px-8 py-3", loading && "opacity-70 cursor-not-allowed")}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Extraction en cours…</>
                  : <><Zap className="w-4 h-4" /> Lancer la recherche</>}
              </button>
            </div>

            {/* Erreur */}
            {!loading && error && (
              <div className="glass rounded-2xl p-4 mb-5 flex items-center gap-3 border-red-500/20 bg-red-500/[0.05]">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Barre de progression */}
            {loading && (
              <div className="glass rounded-2xl p-5 mb-5 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-brand-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Extraction en cours…</p>
                <p className="text-xs text-white/40">
                  {progress < 30
                    ? "Géolocalisation de la ville…"
                    : progress < 75
                    ? "OpenStreetMap · Annuaire des Entreprises…"
                    : "Tri par téléphone · enrichissement depuis sites web…"}
                </p>
                <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Résultats */}
            {!loading && leads.length > 0 && (
              <>
                {/* Stats + toolbar */}
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Tout sélectionner */}
                    <button onClick={toggleAll}
                      className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors">
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-brand-400" />
                        : <Square className="w-4 h-4" />}
                      {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    <span className="text-white font-bold text-sm">
                      {sortedAndFiltered.length} résultat{sortedAndFiltered.length !== 1 ? "s" : ""}
                    </span>
                    {stats && (
                      <span className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 text-emerald-400">
                          <Phone className="w-3 h-3" /> {stats.withPhone} avec tél.
                        </span>
                        {enriching && (
                          <span className="flex items-center gap-1 text-brand-400/70 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Enrichissement tél. en cours…
                          </span>
                        )}
                        {!enriching && enrichedCount > 0 && (
                          <span className="text-emerald-400/60 text-[10px]">
                            +{enrichedCount} tél. trouvé{enrichedCount > 1 ? "s" : ""} via sites web
                          </span>
                        )}
                        {stats.osm > 0 && <span className="text-white/20">{stats.osm} OSM</span>}
                        {stats.sirene > 0 && <span className="text-white/20">{stats.sirene} Annuaire</span>}
                      </span>
                    )}
                    {/* Filtre téléphone */}
                    <button
                      onClick={() => setShowOnlyPhone((v) => !v)}
                      className={cn(
                        "text-xs flex items-center gap-1.5 rounded-full px-3 py-1 border transition-all",
                        showOnlyPhone
                          ? "bg-brand-500/20 border-brand-500/40 text-brand-300"
                          : "border-white/10 text-white/40 hover:text-white/70"
                      )}>
                      <Phone className="w-3 h-3" />
                      {showOnlyPhone ? "Tous les leads" : "Avec tél. seulement"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-white/30" />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="select w-auto text-xs py-1.5 px-3">
                      <option value="phone">Trier : tél. en premier</option>
                      <option value="name">Trier par nom</option>
                      <option value="rating">Trier par note</option>
                      <option value="reviews">Trier par avis</option>
                    </select>
                  </div>
                </div>

                {/* Grille leads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 pb-24">
                  {sortedAndFiltered.map((lead: any) => {
                    const isSelected = selectedIds.has(lead.id);
                    const isAdded    = !!lead._added;
                    const hasPhone   = !!lead.phone;
                    return (
                      <div
                        key={lead.id}
                        onClick={() => setDetailLead(lead)}
                        className={cn(
                          "glass rounded-xl p-4 cursor-pointer transition-all relative",
                          isSelected ? "border-brand-500/50 bg-brand-500/[0.07]" : "hover:border-white/15",
                          isAdded    && "border-emerald-500/30 opacity-70",
                          hasPhone   && "border-l-2 border-l-emerald-500/40"
                        )}>
                        {/* Checkbox */}
                        <button
                          onClick={(e) => toggleOne(lead.id, e)}
                          className="absolute top-3 right-3 z-10 transition-opacity">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-brand-400" />
                            : <Square className="w-4 h-4 text-white/20 hover:text-white/50" />}
                        </button>

                        <div className="pr-6">
                          {/* Header */}
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white truncate">{lead.name}</h3>
                              <p className="text-xs text-white/40">{lead.category} · {lead.city}</p>
                            </div>
                            {lead.rating > 0 && (
                              <div className="shrink-0 text-right">
                                <div className="text-amber-400 text-xs font-bold">★ {lead.rating}</div>
                                {lead.reviewCount > 0 && <div className="text-[9px] text-white/25">{lead.reviewCount} avis</div>}
                              </div>
                            )}
                          </div>

                          {/* Téléphone — point central */}
                          <div className="flex items-center gap-2 mb-2 min-h-[22px]">
                            <Phone className={cn("w-3 h-3 shrink-0", hasPhone ? "text-emerald-400" : "text-white/20")} />
                            {hasPhone ? (
                              <PhoneBadge phone={lead.phone} />
                            ) : (
                              <PhoneLookupBtn name={lead.name} city={lead.city || city} />
                            )}
                          </div>

                          {/* Adresse */}
                          {lead.address && (
                            <div className="flex items-center gap-1.5 text-white/35 text-xs mb-2">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{lead.address}</span>
                            </div>
                          )}

                          {lead.website && (
                            <div className="flex items-center gap-1.5 text-white/35 text-xs mb-2">
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate text-brand-400/60">{lead.website}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                            {hasPhone ? (
                              <a href={`tel:${lead.phone.replace(/\s/g,"")}`}
                                className="flex-1 flex items-center justify-center gap-1 text-[10px] btn-primary py-1.5 rounded-lg">
                                <Phone className="w-3 h-3" /> Appeler
                              </a>
                            ) : (
                              <a
                                href={`https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(lead.name)}&ou=${encodeURIComponent(lead.city || city)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-lg border border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10 transition-all"
                              >
                                <ExternalLink className="w-3 h-3" /> Trouver tél.
                              </a>
                            )}
                            <button
                              onClick={() => {
                                fetch("/api/leads", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify([lead]),
                                });
                                setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, _added: true } as any : l));
                              }}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-lg border transition-all",
                                isAdded
                                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                  : "btn-outline"
                              )}>
                              {isAdded ? <><Check className="w-3 h-3" /> Ajouté</> : <><Database className="w-3 h-3" /> CRM</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Empty state */}
            {!loading && !searched && (
              <div className="text-center py-16 text-white/25">
                <Search className="w-10 h-10 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-white/40 mb-2">Lance ta première recherche</p>
                <p className="text-sm">Configure le secteur et la ville, puis clique sur &quot;Lancer la recherche&quot;</p>
              </div>
            )}
            {!loading && searched && leads.length === 0 && (
              <div className="text-center py-16 text-white/25">
                <p className="font-medium text-white/40 mb-2">Aucun résultat</p>
                <p className="text-sm">Essaie un rayon plus grand ou une ville différente</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau de détail lead ── */}
        {detailLead && (
          <aside className="w-80 shrink-0 border-l border-white/[0.06] bg-ink-900/60 flex flex-col h-full overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-white truncate">{detailLead.name}</h2>
              <button onClick={() => setDetailLead(null)} className="text-white/30 hover:text-white ml-2 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Infos essentielles */}
              <div className="space-y-3">
                <DetailRow label="Catégorie" value={detailLead.category} />
                <DetailRow label="Statut" value={(detailLead as any)._added ? "✅ Ajouté au CRM" : "Non ajouté"} />
                <DetailRow label="Ville" value={detailLead.city} />
                {detailLead.address && <DetailRow label="Adresse" value={detailLead.address} />}

                {/* Téléphone */}
                <div>
                  <p className="text-[10px] text-white/30 mb-1.5">Téléphone</p>
                  {detailLead.phone ? (
                    <a href={`tel:${detailLead.phone.replace(/\s/g,"")}`}
                      className="font-mono text-emerald-300 text-base font-bold hover:text-emerald-200 block mb-1">
                      {detailLead.phone}
                    </a>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-white/30 text-xs">Numéro non disponible dans les sources libres.</p>
                      <div className="flex gap-2">
                        <a
                          href={`https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(detailLead.name)}&ou=${encodeURIComponent(detailLead.city)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 rounded-lg px-3 py-1.5 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" /> Pages Jaunes
                        </a>
                        <a
                          href={`https://www.google.fr/search?q=${encodeURIComponent(`"${detailLead.name}" ${detailLead.city} téléphone`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 rounded-lg px-3 py-1.5 transition-all"
                        >
                          <Search className="w-3 h-3" /> Google
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Note Google */}
                {detailLead.rating > 0 && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Note</p>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-amber-400 font-bold">{detailLead.rating}</span>
                      {detailLead.reviewCount > 0 && (
                        <span className="text-xs text-white/30">({detailLead.reviewCount} avis)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Site web */}
                {detailLead.website && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Site web</p>
                    <a href={`https://${detailLead.website}`} target="_blank" rel="noopener noreferrer"
                      className="text-brand-400 hover:underline text-xs">{detailLead.website}</a>
                  </div>
                )}

                {/* Notes */}
                {detailLead.notes && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Notes</p>
                    <p className="text-xs text-white/60 italic leading-relaxed">{detailLead.notes}</p>
                  </div>
                )}
              </div>

              {/* Source */}
              <div className="text-[9px] text-white/20 pt-2 border-t border-white/[0.06]">
                Source : {detailLead.id.startsWith("osm") ? "OpenStreetMap" : detailLead.id.startsWith("sirene") ? "Annuaire des Entreprises (INSEE)" : "Manuel"}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {detailLead.phone ? (
                  <a href={`tel:${detailLead.phone.replace(/\s/g,"")}`}
                    className="btn-primary flex items-center justify-center gap-2 text-sm w-full py-3 rounded-xl">
                    <Phone className="w-4 h-4" /> Appeler maintenant
                  </a>
                ) : (
                  <a
                    href={`https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(detailLead.name)}&ou=${encodeURIComponent(detailLead.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm w-full py-3 rounded-xl border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" /> Trouver le tél. (Pages Jaunes)
                  </a>
                )}
                <button
                  onClick={() => {
                    fetch("/api/leads", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify([detailLead]),
                    });
                    setLeads((prev) => prev.map((l) => l.id === detailLead.id ? { ...l, _added: true } as any : l));
                    setDetailLead({ ...detailLead, _added: true } as any);
                  }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 text-sm py-3 rounded-xl border transition-all",
                    (detailLead as any)._added
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "btn-outline"
                  )}>
                  {(detailLead as any)._added
                    ? <><Check className="w-4 h-4" /> Déjà dans le CRM</>
                    : <><Database className="w-4 h-4" /> Ajouter au CRM</>}
                </button>
                <a href="/app"
                  className="btn-outline flex items-center justify-center gap-2 text-xs w-full py-2.5 rounded-xl">
                  Interface d&apos;appel <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* ── Barre d'action flottante (sélection multiple) ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink-900 border border-white/[0.12] rounded-2xl px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <span className="text-white font-semibold text-sm">
            {selectedIds.size} prospect{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={bulkAddToCrm}
            disabled={addingBulk}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            {addingBulk
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Ajout…</>
              : <><Database className="w-4 h-4" /> Transférer vers le CRM</>}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Confirmation bulk ── */}
      {bulkAdded && !addingBulk && selectedIds.size === 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl px-5 py-3 shadow-2xl">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300 font-semibold text-sm">Leads transférés dans le CRM ✓</span>
          <button onClick={() => setBulkAdded(false)} className="text-emerald-400/50 hover:text-emerald-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
      <p className="text-sm text-white/80">{value}</p>
    </div>
  );
}
