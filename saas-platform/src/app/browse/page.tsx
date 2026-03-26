'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  user: { id: string; email: string; role: string }
}

function BrowseContent() {
  const searchParams = useSearchParams()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') ?? 'all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setCurrentUserId(data.user.id)
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (availableOnly) params.set('available', 'true')
    if (search) params.set('search', search)

    fetch(`/api/profiles?${params}`)
      .then(r => r.json())
      .then(data => setProfiles(data.profiles ?? []))
      .finally(() => setLoading(false))
  }, [roleFilter, availableOnly, search])

  useEffect(() => {
    fetch('/api/connections')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.connections) return
        const ids = new Set<string>(
          data.connections.map((c: { from: { id: string }; to: { id: string } }) =>
            c.from.id === currentUserId ? c.to.id : c.from.id
          )
        )
        setConnected(ids)
      })
  }, [currentUserId])

  const handleConnect = async (toId: string) => {
    if (!currentUserId) { window.location.href = '/auth/login'; return }
    setConnecting(toId)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId }),
    })
    if (res.ok) {
      setConnected(prev => new Set([...prev, toId]))
    }
    setConnecting(null)
  }

  const roleLabel = (role: string) => role === 'setter' ? 'Setter' : 'Entrepreneur'
  const roleColor = (role: string) => role === 'setter'
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-purple-100 text-purple-700'

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Parcourir les profils</h1>
          <p className="text-gray-500">Trouvez votre partenaire idéal</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, titre, compétences..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'setter', 'entrepreneur'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  roleFilter === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r === 'all' ? 'Tous' : r === 'setter' ? 'Setters' : 'Entrepreneurs'}
              </button>
            ))}
            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                availableOnly ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Disponibles
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="h-12 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-gray-700 font-semibold mb-2">Aucun profil trouvé</h3>
            <p className="text-gray-400 text-sm">Modifiez vos filtres ou revenez plus tard</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">{profiles.length} profil{profiles.length > 1 ? 's' : ''} trouvé{profiles.length > 1 ? 's' : ''}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {profiles
                .filter(p => p.user.id !== currentUserId)
                .map(profile => {
                  const skills = JSON.parse(profile.skills) as string[]
                  const isConnected = connected.has(profile.user.id)
                  return (
                    <div key={profile.id} className="bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${
                            profile.user.role === 'setter' ? 'bg-indigo-600' : 'bg-purple-600'
                          }`}>
                            {profile.name[0].toUpperCase()}
                          </div>
                          <div>
                            <Link href={`/profile/${profile.user.id}`} className="font-bold text-gray-900 text-sm hover:text-indigo-600">
                              {profile.name}
                            </Link>
                            <p className="text-gray-500 text-xs mt-0.5">{profile.title}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColor(profile.user.role)}`}>
                          {roleLabel(profile.user.role)}
                        </span>
                      </div>

                      <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-2">{profile.bio}</p>

                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {skills.slice(0, 4).map((s: string) => (
                            <span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="text-gray-400 text-xs">+{skills.length - 4}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {profile.hourlyRate && (
                            <span className="font-semibold text-gray-700">{profile.hourlyRate}€/h</span>
                          )}
                          {profile.available && (
                            <span className="flex items-center gap-1 text-green-600">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              Disponible
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleConnect(profile.user.id)}
                          disabled={isConnected || connecting === profile.user.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                            isConnected
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {connecting === profile.user.id ? '...' : isConnected ? 'Connecté' : 'Contacter'}
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </>
        )}
      </main>
    </>
  )
}

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseContent />
    </Suspense>
  )
}
