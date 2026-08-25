"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Loader2, Check, X, Shield, User, BarChart2, Zap,
  LogOut, ChevronLeft,
} from "lucide-react";
import type { PublicUser } from "@/lib/db-users";

interface UserWithStats extends PublicUser {
  stats?: { leads: number; prospects: number };
}

interface CurrentUser { id: string; email: string; name: string; role: string }

// ── Modale création / édition ─────────────────────────────────────────────────
function UserModal({
  user,
  onSave,
  onClose,
}: {
  user?: UserWithStats | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [name,     setName]     = useState(user?.name     ?? "");
  const [email,    setEmail]    = useState(user?.email    ?? "");
  const [role,     setRole]     = useState<"admin" | "sdr">(user?.role ?? "sdr");
  const [password, setPassword] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url    = isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = { name, userRole: role };
      if (!isEdit) { body.email = email; body.password = password; }
      else if (password) { body.password = password; }

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      onSave();
      onClose();
    } catch { setError("Erreur réseau"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Modifier le compte" : "Créer un compte SDR"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom complet</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@entreprise.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEdit ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe"}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "••••••••" : "min 8 caractères"} required={!isEdit} minLength={8}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "sdr")}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white">
              <option value="sdr">SDR — Cold Caller</option>
              <option value="admin">Admin — Accès complet</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [me,      setMe]      = useState<CurrentUser | null>(null);
  const [users,   setUsers]   = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<UserWithStats | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);  // id à supprimer

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    if (!r.ok) { router.replace("/login"); return; }
    const d = await r.json() as { user: CurrentUser };
    if (d.user.role !== "admin") { router.replace("/dashboard"); return; }
    setMe(d.user);
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/users");
    if (r.ok) {
      const d = await r.json() as { users: UserWithStats[] };
      setUsers(d.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadMe().then(loadUsers); }, [loadMe, loadUsers]);

  async function toggleActive(user: UserWithStats) {
    await fetch(`/api/admin/users/${user.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !user.active }),
    });
    loadUsers();
  }

  async function deleteUser(id: string) {
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setConfirm(null);
    loadUsers();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const sdrs   = users.filter((u) => u.role === "sdr");
  const admins = users.filter((u) => u.role === "admin");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-gray-900">Administration</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {me && (
            <span className="text-sm text-gray-500">
              Connecté : <span className="font-medium text-gray-900">{me.name}</span>
            </span>
          )}
          <button onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Membres total",    value: users.length,   icon: Users },
            { label: "SDR actifs",        value: sdrs.filter(u => u.active).length, icon: User },
            { label: "Prospects total",   value: users.reduce((s, u) => s + (u.stats?.prospects ?? 0), 0), icon: BarChart2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-brand-500" />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Équipe */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Équipe</h2>
              <p className="text-xs text-gray-400 mt-0.5">{users.length} membre{users.length > 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => { setEditing(null); setModal("create"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all">
              <Plus className="w-4 h-4" />
              Nouveau compte
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                    user.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{user.name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        user.role === "admin"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {user.role === "admin" ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                        {user.role === "admin" ? "Admin" : "SDR"}
                      </span>
                      {!user.active && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
                          Désactivé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400">
                    <span><span className="font-medium text-gray-700">{user.stats?.prospects ?? 0}</span> prospects</span>
                    <span><span className="font-medium text-gray-700">{user.stats?.leads ?? 0}</span> leads</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Activer / Désactiver */}
                    {user.id !== me?.id && (
                      <button
                        onClick={() => toggleActive(user)}
                        title={user.active ? "Désactiver" : "Activer"}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                        {user.active
                          ? <ToggleRight className="w-4 h-4 text-green-500" />
                          : <ToggleLeft  className="w-4 h-4" />
                        }
                      </button>
                    )}
                    {/* Éditer */}
                    <button
                      onClick={() => { setEditing(user); setModal("edit"); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {/* Supprimer */}
                    {user.id !== me?.id && (
                      <button
                        onClick={() => setConfirm(user.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Aucun utilisateur — crée le premier compte SDR
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modale création / édition */}
      {modal && (
        <UserModal
          user={modal === "edit" ? editing : null}
          onSave={loadUsers}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}

      {/* Confirmation suppression */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Supprimer ce compte ?</h3>
                <p className="text-xs text-gray-500">Cette action est irréversible</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                Annuler
              </button>
              <button onClick={() => deleteUser(confirm)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
