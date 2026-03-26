'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface Profile {
  id: string
  name: string
  title: string
  bio: string
  skills: string
  hourlyRate: number | null
  location: string | null
  available: boolean
}

interface User {
  id: string
  email: string
  role: string
  profile: Profile | null
}

interface Connection {
  id: string
  status: string
  from: { id: string; profile: Profile | null }
  to: { id: string; profile: Profile | null }
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) { router.push('/auth/login'); return }
        setUser(data.user)
      })
      .catch(() => router.push('/auth/login'))
  }, [router])

  useEffect(() => {
    if (!user) return
    fetch('/api/connections')
      .then(r => r.json())
      .then(data => setConnections(data.connections ?? []))
      .finally(() => setLoading(false))
  }, [user])

  const handleConnectionResponse = async (id: string, status: 'accepted' | 'rejected') => {
    const res = await fetch('/api/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: id, status }),
    })
    if (res.ok) {
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    }
  }

  if (!user) return null

  const skills = user.profile?.skills ? JSON.parse(user.profile.skills) as string[] : []
  const pendingReceived = connections.filter(c => c.status === 'pending' && c.to.id === user.id)
  const accepted = connections.filter(c => c.status === 'accepted')

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour, {user.profile?.name ?? user.email.split('@')[0]} !
            </h1>
            <p className="text-gray-500 mt-1">
              Vous êtes connecté en tant que{' '}
              <span className={`font-medium ${user.role === 'setter' ? 'text-indigo-600' : 'text-purple-600'}`}>
                {user.role === 'setter' ? 'Setter' : 'Entrepreneur'}
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/browse" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              Parcourir les profils
            </Link>
            <Link href="/profile/edit" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium">
              Mon profil
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="md:col-span-2 space-y-6">
            {/* Profile summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 ${
                  user.role === 'setter' ? 'bg-indigo-600' : 'bg-purple-600'
                }`}>
                  {(user.profile?.name ?? user.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 text-lg">{user.profile?.name}</h2>
                  <p className="text-gray-500 text-sm">{user.profile?.title}</p>
                  {user.profile?.location && (
                    <p className="text-gray-400 text-xs mt-1">{user.profile.location}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {skills.slice(0, 5).map((s: string) => (
                      <span key={s} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.profile?.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.profile?.available ? 'Disponible' : 'Indisponible'}
                  </span>
                  {user.profile?.hourlyRate && (
                    <p className="text-gray-900 font-bold mt-2">{user.profile.hourlyRate}€/h</p>
                  )}
                </div>
              </div>
              {user.profile?.bio && (
                <p className="text-gray-600 text-sm mt-4 leading-relaxed">{user.profile.bio}</p>
              )}
            </div>

            {/* Pending connection requests */}
            {pendingReceived.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 bg-amber-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {pendingReceived.length}
                  </span>
                  Demandes de connexion en attente
                </h3>
                <div className="space-y-3">
                  {pendingReceived.map(conn => {
                    const other = conn.from
                    return (
                      <div key={conn.id} className="flex items-center justify-between bg-white rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                            {(other.profile?.name ?? 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{other.profile?.name ?? 'Utilisateur'}</p>
                            <p className="text-gray-500 text-xs">{other.profile?.title}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConnectionResponse(conn.id, 'accepted')}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => handleConnectionResponse(conn.id, 'rejected')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-lg font-medium"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Accepted connections */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Mes connexions ({accepted.length})</h3>
              {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
              ) : accepted.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm mb-3">Aucune connexion pour l&apos;instant</p>
                  <Link href="/browse" className="text-indigo-600 text-sm font-medium hover:underline">
                    Parcourir les profils
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {accepted.map(conn => {
                    const other = conn.from.id === user.id ? conn.to : conn.from
                    return (
                      <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">
                            {(other.profile?.name ?? 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{other.profile?.name ?? 'Utilisateur'}</p>
                            <p className="text-gray-500 text-xs">{other.profile?.title}</p>
                          </div>
                        </div>
                        <Link
                          href={`/messages?with=${other.id}`}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                        >
                          Envoyer un message
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column - Quick stats */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Activité</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Connexions</span>
                  <span className="font-bold text-gray-900">{accepted.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">En attente</span>
                  <span className="font-bold text-amber-600">{pendingReceived.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Complétez votre profil</h3>
              <p className="text-gray-500 text-xs mb-4">Ajoutez vos compétences et tarifs pour attirer plus de connexions</p>
              <Link
                href="/profile/edit"
                className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
              >
                Modifier le profil
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Besoin d&apos;aide ?</h3>
              <p className="text-gray-500 text-xs mb-3">Découvrez comment tirer le meilleur de SetterLink</p>
              <Link href="/browse" className="text-indigo-600 text-xs font-medium hover:underline">
                Voir les profils recommandés →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
