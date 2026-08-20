"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, Phone, Plus, Trash2, Save, Loader2, X, CheckCircle,
  FileText, Pencil, Copy, Eye, ChevronRight, Sparkles, Info,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import type { EmailTemplate } from "@/lib/db-templates";
import type { CallScriptSection } from "@/lib/db-scripts";

// ── Couleurs section script ───────────────────────────────────────────────────
const SECTION_COLORS: Record<CallScriptSection["color"], { bg: string; border: string; dot: string; label: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500",    label: "text-blue-700"    },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-500",  label: "text-violet-700"  },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   label: "text-amber-700"   },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", label: "text-emerald-700" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500",    label: "text-rose-700"    },
  teal:    { bg: "bg-teal-50",    border: "border-teal-200",    dot: "bg-teal-500",    label: "text-teal-700"    },
  gray:    { bg: "bg-gray-50",    border: "border-gray-200",    dot: "bg-gray-400",    label: "text-gray-700"    },
};

// ── Variables disponibles ─────────────────────────────────────────────────────
const EMAIL_VARS = [
  { key: "{{nom}}",       desc: "Raison sociale de l'entreprise" },
  { key: "{{dirigeant}}", desc: "Nom du dirigeant principal" },
  { key: "{{ville}}",     desc: "Ville du prospect" },
  { key: "{{secteur}}",   desc: "Secteur d'activité (ex: Plombier)" },
  { key: "{{site}}",      desc: "Nom de domaine du site web" },
  { key: "{{siren}}",     desc: "Numéro SIREN" },
];

const CALL_VARS = [
  { key: "[NOM]",             desc: "Prénom/nom du contact" },
  { key: "[NOM_ENTREPRISE]",  desc: "Raison sociale" },
  { key: "[VOTRE NOM]",       desc: "Votre prénom" },
  { key: "[VOTRE SOCIÉTÉ]",   desc: "Votre entreprise" },
  { key: "[SECTEUR]",         desc: "Secteur d'activité" },
  { key: "[VILLE]",           desc: "Ville du prospect" },
  { key: "[EMAIL]",           desc: "Email du contact" },
];

// ── Composant : onglet Emails ─────────────────────────────────────────────────
function EmailsTab() {
  const [templates, setTemplates]     = useState<EmailTemplate[]>([]);
  const [selected,  setSelected]      = useState<EmailTemplate | null>(null);
  const [loading,   setLoading]       = useState(true);
  const [saving,    setSaving]        = useState(false);
  const [saved,     setSaved]         = useState(false);
  const [deleting,  setDeleting]      = useState(false);
  const [isNew,     setIsNew]         = useState(false);
  const [preview,   setPreview]       = useState(false);

  // Champs d'édition locaux
  const [name,    setName]    = useState("");
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Charger les templates
  useEffect(() => {
    fetch("/api/prospection/templates")
      .then((r) => r.json())
      .then((d) => { setTemplates(d.templates ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Sélectionner un template
  const select = useCallback((tpl: EmailTemplate) => {
    setSelected(tpl);
    setIsNew(false);
    setName(tpl.name);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setPreview(false);
    setSaved(false);
  }, []);

  const startNew = () => {
    setSelected(null);
    setIsNew(true);
    setName("");
    setSubject("");
    setBody("");
    setPreview(false);
    setSaved(false);
  };

  const saveTemplate = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const res  = await fetch("/api/prospection/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, subject, body }),
        });
        const data = await res.json() as { template?: EmailTemplate };
        if (data.template) {
          setTemplates((prev) => [...prev, data.template!]);
          setSelected(data.template!);
          setIsNew(false);
        }
      } else if (selected) {
        const res  = await fetch("/api/prospection/templates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id, patch: { name, subject, body } }),
        });
        const data = await res.json() as { template?: EmailTemplate };
        if (data.template) {
          setTemplates((prev) => prev.map((t) => t.id === data.template!.id ? data.template! : t));
          setSelected(data.template!);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selected || !confirm(`Supprimer le modèle "${selected.name}" ?`)) return;
    setDeleting(true);
    try {
      await fetch("/api/prospection/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      setTemplates((prev) => prev.filter((t) => t.id !== selected.id));
      setSelected(null);
      setIsNew(false);
      setName(""); setSubject(""); setBody("");
    } finally {
      setDeleting(false);
    }
  };

  const insertVar = (v: string) => {
    const ta = bodyRef.current;
    if (!ta) { setBody((b) => b + v); return; }
    const start = ta.selectionStart ?? body.length;
    const end   = ta.selectionEnd   ?? body.length;
    const next  = body.slice(0, start) + v + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const isDirty = selected
    ? name !== selected.name || subject !== selected.subject || body !== selected.body
    : (isNew && (name || subject || body));

  const copyAll = () => navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Liste gauche ── */}
      <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Modèles</p>
          <button onClick={startNew}
            className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 font-medium transition-colors">
            <Plus className="w-3 h-3" /> Nouveau
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
          )}
          {isNew && (
            <div className="px-4 py-3 bg-brand-50 border-b border-brand-100 border-l-2 border-l-brand-500">
              <p className="text-xs font-semibold text-brand-700">✦ Nouveau modèle</p>
              <p className="text-[10px] text-brand-400 mt-0.5">Non enregistré</p>
            </div>
          )}
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => select(tpl)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors group",
                selected?.id === tpl.id
                  ? "bg-brand-50 border-l-2 border-l-brand-500"
                  : "hover:bg-gray-50"
              )}>
              <p className={cn("text-xs font-semibold truncate", selected?.id === tpl.id ? "text-brand-700" : "text-gray-900")}>
                {tpl.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{tpl.subject}</p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {tpl.variables.slice(0, 4).map((v) => (
                  <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {!loading && templates.length === 0 && (
            <p className="text-xs text-gray-300 text-center py-8">Aucun modèle</p>
          )}
        </div>
      </div>

      {/* ── Éditeur droite ── */}
      {(selected || isNew) ? (
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Formulaire */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-50">
            {/* Toolbar */}
            <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du modèle…"
                className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none flex-1 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setPreview(!preview)}
                  className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
                    preview ? "bg-brand-50 text-brand-700 border-brand-300" : "border-gray-200 text-gray-500 hover:border-gray-400"
                  )}>
                  <Eye className="w-3.5 h-3.5" /> Aperçu
                </button>
                <button onClick={copyAll}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg transition-all">
                  <Copy className="w-3.5 h-3.5" /> Copier
                </button>
                {selected && (
                  <button onClick={deleteTemplate} disabled={deleting}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={saveTemplate} disabled={saving || !isDirty}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-all",
                    isDirty
                      ? "btn-primary py-1.5 text-xs"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   saved  ? <CheckCircle className="w-3.5 h-3.5" /> :
                            <Save className="w-3.5 h-3.5" />}
                  {saved ? "Sauvegardé" : "Sauvegarder"}
                </button>
              </div>
            </div>

            {preview ? (
              /* Aperçu */
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Objet</p>
                    <p className="text-sm font-semibold text-gray-900">{subject || <span className="text-gray-300 italic">Objet non défini</span>}</p>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-3">Corps</p>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                      {body || <span className="text-gray-300 italic">Corps vide</span>}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              /* Éditeur */
              <div className="flex-1 overflow-auto p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Objet de l'email
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ex: {{nom}} — Une question rapide"
                    className="input w-full text-sm font-medium"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Corps de l'email
                  </label>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Rédigez votre email ici…&#10;&#10;Utilisez {{nom}}, {{dirigeant}}, {{ville}} pour personnaliser automatiquement."
                    rows={14}
                    className="input text-sm resize-none leading-relaxed"
                  />
                </div>
                {body && (
                  <p className="text-[10px] text-gray-300">
                    {body.split(/\s+/).filter(Boolean).length} mots · {body.length} caractères ·{" "}
                    {(body.match(/\{\{[^}]+\}\}/g)?.length ?? 0)} variable(s)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Variables sidebar */}
          <div className="w-52 shrink-0 border-l border-gray-200 bg-white overflow-auto">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Variables
              </p>
              <p className="text-[10px] text-gray-300 mt-1">Cliquer pour insérer dans le corps</p>
            </div>
            <div className="p-3 space-y-1.5">
              {EMAIL_VARS.map(({ key, desc }) => (
                <button
                  key={key}
                  onClick={() => insertVar(key)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-300 transition-all group">
                  <p className="text-[10px] font-mono font-semibold text-brand-600 group-hover:text-brand-700">{key}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 mb-1">
                  <Info className="w-3 h-3" /> Tip
                </p>
                <p className="text-[10px] text-blue-500 leading-snug">
                  Les variables sont remplacées automatiquement lors de l'envoi depuis la fiche prospect.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Sélectionnez un modèle</h3>
          <p className="text-xs text-gray-400 mb-4">ou créez-en un nouveau pour commencer</p>
          <button onClick={startNew} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau modèle
          </button>
        </div>
      )}
    </div>
  );
}

// ── Composant : onglet Scripts d'appel ────────────────────────────────────────
function CallScriptTab() {
  const [sections, setSections] = useState<CallScriptSection[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [editTitles, setEditTitles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/scripts/call")
      .then((r) => r.json())
      .then((d) => { setSections(d.sections ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateSection = (id: string, patch: Partial<CallScriptSection>) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const addSection = () => {
    const colors: CallScriptSection["color"][] = ["blue", "violet", "amber", "emerald", "rose", "teal", "gray"];
    const newSection: CallScriptSection = {
      id:      `section-${Date.now()}`,
      title:   "✨ Nouvelle section",
      content: "",
      color:   colors[sections.length % colors.length],
    };
    setSections((prev) => [...prev, newSection]);
    setDirty(true);
  };

  const removeSection = (id: string) => {
    if (!confirm("Supprimer cette section ?")) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/scripts/call", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Script d'appel</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Personnalisez chaque phase de votre argumentaire · utilisez les variables [NOM], [NOM_ENTREPRISE], etc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addSection}
            className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-brand-400 text-gray-500 hover:text-brand-600 px-3 py-1.5 rounded-lg transition-all">
            <Plus className="w-3.5 h-3.5" /> Ajouter une section
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-all",
              dirty ? "btn-primary py-1.5 text-xs" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             saved  ? <CheckCircle className="w-3.5 h-3.5" /> :
                      <Save className="w-3.5 h-3.5" />}
            {saved ? "Sauvegardé !" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
          {sections.map((section, idx) => {
            const col = SECTION_COLORS[section.color];
            const editingTitle = !!editTitles[section.id];
            return (
              <div key={section.id} className={cn("rounded-xl border overflow-hidden shadow-sm", col.border)}>
                {/* Section header */}
                <div className={cn("px-4 py-3 flex items-center justify-between border-b", col.bg, col.border)}>
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", col.dot)} />
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        onBlur={() => setEditTitles((p) => ({ ...p, [section.id]: false }))}
                        onKeyDown={(e) => e.key === "Enter" && setEditTitles((p) => ({ ...p, [section.id]: false }))}
                        className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-0"
                      />
                    ) : (
                      <span className={cn("text-sm font-semibold truncate", col.label)}>{section.title}</span>
                    )}
                    <button
                      onClick={() => setEditTitles((p) => ({ ...p, [section.id]: !p[section.id] }))}
                      className="shrink-0 text-gray-300 hover:text-gray-600 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(section.content)}
                      title="Copier"
                      className="text-gray-300 hover:text-gray-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeSection(section.id)}
                      title="Supprimer"
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Section body */}
                <div className="bg-white">
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                    placeholder="Rédigez cette phase du script ici…&#10;Utilisez [NOM], [NOM_ENTREPRISE], [SECTEUR], [VILLE] pour personnaliser."
                    rows={Math.max(4, (section.content.match(/\n/g)?.length ?? 0) + 2)}
                    className="w-full px-4 py-3 text-sm text-gray-700 resize-none border-none outline-none leading-relaxed placeholder:text-gray-300 font-mono"
                  />
                </div>
              </div>
            );
          })}

          {/* Variables référence */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Variables disponibles dans les scripts
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CALL_VARS.map(({ key, desc }) => (
                <button
                  key={key}
                  onClick={() => navigator.clipboard.writeText(key)}
                  title="Copier la variable"
                  className="text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-300 transition-all group">
                  <p className="text-[10px] font-mono font-semibold text-brand-600">{key}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {dirty && (
            <div className="flex justify-center pb-4">
              <button onClick={save} disabled={saving}
                className="btn-primary text-sm py-2.5 px-8 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Sauvegarde…" : "Sauvegarder les scripts"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
type Tab = "emails" | "call";

export default function ScriptsPage() {
  const [tab, setTab] = useState<Tab>("emails");

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Navbar />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-0 bg-white border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-base font-bold text-gray-900">Scripts & Modèles</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Gérez vos templates email personnalisés et vos scripts d'appel
              </p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {([
              { id: "emails", label: "Modèles Email",       icon: Mail  },
              { id: "call",   label: "Scripts d'appel",     icon: Phone },
            ] as { id: Tab; label: string; icon: typeof Mail }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
                  tab === id
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                )}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu de l'onglet actif */}
        {tab === "emails" ? <EmailsTab /> : <CallScriptTab />}
      </div>
    </div>
  );
}
