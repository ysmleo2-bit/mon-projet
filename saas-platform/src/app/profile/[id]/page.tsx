'use client'

import { useState, useEffect, use } from 'react'
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
  website: string | null
  available: boolean
  user: { id: string; email: string; role: string }
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user) setCurrentUserId(data.user.id) })
  }, [])

  useEffect(() => {
    fetch(`/api/profiles/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.profile) { router.push('/browse'); return }
        setProfile(data.profile)
      })
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    if (!currentUserId || !profile) return
    fetch('/api/connections')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.connections) return
        const isConnected = data.connections.some(
          (c: { from: { id: string }; to: { id: string } }) =>
            (c.from.id === currentUserId && c.to.id === profile.user.id) ||
            (c.from.id === profile.user.id && c.to.id === currentUserId)
        )
        setConnected(isConnected)
      })
  }, [currentUserId, profile])

  const handleConnect = async () => {
    if (!currentUserId) { router.push('/auth/login'); return }
    setConnecting(true)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: profile!.user.id }),
    })
    if (res.ok) setConnected(true)
    setConnecting(false)
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Chargement...</div>
        </div>
      </>
    )
  }

  if (!profile) return null

  const skills = JSON.parse(profile.skills) as string[]
  const isOwnProfile = currentUserId === profile.user.id
  const roleLabel = profile.user.role === 'setter' ? 'Setter' : 'Entrepreneur'
  const roleColor = profile.user.role === 'setter' ? 'bg-indigo-600' : 'bg-purple-600'

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/browse" className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux profils
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className={`${roleColor} h-24`}></div>
          <div className="px-8 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-6">
              <div className="flex items-end gap-4">
                <div className={`w-20 h-20 ${roleColor} rounded-2xl border-4 border-white flex items-center justify-center text-3xl font-bold text-white`}>
                  {profile.name[0].toUpperCase()}
                </div>
                <div className="pb-1">
                  <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-500 text-sm">{profile.title}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {isOwnProfile ? (
                  <Link href="/profile/edit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                    Modifier
                  </Link>
                ) : (
                  <>
                    {connected ? (
                      <Link href={`/messages?with=${profile.user.id}`} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                        Envoyer un message
                      </Link>
                    ) : (
                      <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
                      >
                        {connecting ? 'Envoi...' : 'Se connecter'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                profile.user.role === 'setter' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {roleLabel}
              </span>
              {profile.available && (
                <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Disponible
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                  📍 {profile.location}
                </span>
              )}
              {profile.hourlyRate && (
                <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-semibold">
                  {profile.hourlyRate}€/h
                </span>
              )}
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-6">
              <div>
                <h2 className="font-bold text-gray-900 mb-3">À propos</h2>
                <p className="text-gray-600 leading-relaxed">{profile.bio}</p>
              </div>

              {skills.length > 0 && (
                <div>
                  <h2 className="font-bold text-gray-900 mb-3">Compétences</h2>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s: string) => (
                      <span key={s} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.website && (
                <div>
                  <h2 className="font-bold text-gray-900 mb-2">Liens</h2>
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline">
                    {profile.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
