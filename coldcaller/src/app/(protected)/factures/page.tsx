"use client";

import { useState, useEffect, useRef } from "react";
import {
  Receipt, Plus, Download, Loader2, X, Check,
  Clock, AlertCircle, FileText, Upload, Trash2,
  ChevronDown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type InvoiceStatus = "deposee" | "en_verification" | "validee" | "refusee";

interface Invoice {
  id:               string;
  user_id:          string;
  user_name:        string;
  month:            string;
  invoice_date:     string;
  invoice_number:   string;
  amount:           number;
  file_name:        string;
  file_type:        string;
  status:           InvoiceStatus;
  rejection_reason: string;
  created_at:       string;
}

// ── Statuts ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<InvoiceStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  deposee:         { label: "Déposée",        icon: Clock,         color: "text-blue-700",    bg: "bg-blue-50"    },
  en_verification: { label: "En vérification", icon: Clock,         color: "text-amber-700",   bg: "bg-amber-50"   },
  validee:         { label: "Validée",         icon: Check,         color: "text-emerald-700", bg: "bg-emerald-50" },
  refusee:         { label: "Refusée",         icon: AlertCircle,   color: "text-red-700",     bg: "bg-red-50"     },
};

const MONTHS_LABELS: Record<string, string> = {
  "01": "Janvier", "02": "Février",   "03": "Mars",      "04": "Avril",
  "05": "Mai",     "06": "Juin",      "07": "Juillet",   "08": "Août",
  "09": "Septembre","10": "Octobre",  "11": "Novembre",  "12": "Décembre",
};

function monthLabel(m: string) {
  const [year, mon] = m.split("-");
  return `${MONTHS_LABELS[mon] ?? mon} ${year}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonths(n = 12) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// ── Modale dépôt de facture ────────────────────────────────────────────────────
function DepotModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [month,   setMonth]   = useState(currentMonth());
  const [date,    setDate]    = useState("");
  const [num,     setNum]     = useState("");
  const [amount,  setAmount]  = useState("");
  const [file,    setFile]    = useState<File | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Veuillez sélectionner un fichier"); return; }
    setSaving(true);
    setError(null);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          month,
          invoice_date:   date,
          invoice_number: num,
          amount:         parseFloat(amount) || 0,
          file_name:      file.name,
          file_type:      file.type,
          file_data:      b64,
        }),
      });
      const data = await resp.json() as { error?: string };
      if (!resp.ok) { setError(data.error ?? "Erreur"); return; }
      onSuccess();
      onClose();
    } catch { setError("Erreur réseau"); }
    finally  { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Déposer une facture</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mois */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mois concerné *</label>
            <div className="relative">
              <select required value={month} onChange={(e) => setMonth(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                {prevMonths().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de la facture</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          {/* Numéro + montant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Numéro de facture</label>
              <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Facture-001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant (€)</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          </div>
          {/* Fichier */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fichier facture * (PDF, JPG, PNG)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                file ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              )}>
              {file ? (
                <div className="flex items-center justify-center gap-2 text-brand-600">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Cliquer pour sélectionner un fichier</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG ou PNG</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Déposer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ligne facture ─────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onDownload, onDelete, isAdmin }: {
  inv: Invoice;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.deposee;
  const Icon = cfg.icon;
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {isAdmin && (
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs">
              {inv.user_name[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 font-medium">{inv.user_name}</span>
          </div>
        </td>
      )}
      <td className="px-5 py-4 text-sm text-gray-700 font-medium">{monthLabel(inv.month)}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{inv.invoice_number || "—"}</td>
      <td className="px-4 py-4 text-sm font-medium text-gray-900">
        {inv.amount ? `${Number(inv.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}
      </td>
      <td className="px-4 py-4 text-sm text-gray-500">
        {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("fr-FR") : "—"}
      </td>
      <td className="px-4 py-4">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", cfg.color, cfg.bg)}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
        {inv.status === "refusee" && inv.rejection_reason && (
          <p className="text-xs text-red-500 mt-1 max-w-[160px]">{inv.rejection_reason}</p>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => onDownload(inv.id)} title="Télécharger"
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-all">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(inv.id)} title="Supprimer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function FacturesPage() {
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [me,          setMe]          = useState<{ role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { user: { role: string } } | null) => { if (d?.user) setMe(d.user); })
      .catch(() => {});
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterMonth)  p.set("month",  filterMonth);
      if (filterStatus) p.set("status", filterStatus);
      const res  = await fetch(`/api/invoices?${p}`);
      const data = await res.json() as { invoices: Invoice[] };
      setInvoices(data.invoices ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadInvoices(); }, [filterMonth, filterStatus]);

  async function handleDownload(id: string) {
    const res  = await fetch(`/api/invoices/${id}`);
    const data = await res.json() as { invoice: Invoice & { file_data: string } };
    if (!data.invoice?.file_data) return;
    const byteString = atob(data.invoice.file_data);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    const blob  = new Blob([bytes], { type: data.invoice.file_type });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = data.invoice.file_name; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette facture ?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  const isAdmin = me?.role === "admin";

  return (
    <div className="flex h-screen bg-gray-50">
      <Navbar variant="app" />

      <main className="flex-1 overflow-y-auto">
        {/* En-tête */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isAdmin ? "Factures équipe" : "Mes factures"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isAdmin
                  ? "Toutes les factures déposées par l'équipe"
                  : "Déposez et suivez vos factures mensuelles"}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Déposer une facture
            </button>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="relative">
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Tous les mois</option>
                {prevMonths(6).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Tous les statuts</option>
                <option value="deposee">Déposée</option>
                <option value="en_verification">En vérification</option>
                <option value="validee">Validée</option>
                <option value="refusee">Refusée</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Aucune facture trouvée</p>
              <p className="text-gray-400 text-sm mt-1">Cliquez sur «&nbsp;Déposer une facture&nbsp;» pour commencer</p>
              <button onClick={() => setShowModal(true)}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Déposer une facture
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {isAdmin && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SDR</th>}
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mois</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Facture</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((inv) => (
                      <InvoiceRow key={inv.id} inv={inv} isAdmin={isAdmin}
                        onDownload={handleDownload} onDelete={handleDelete} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <DepotModal onClose={() => setShowModal(false)} onSuccess={loadInvoices} />
      )}
    </div>
  );
}
