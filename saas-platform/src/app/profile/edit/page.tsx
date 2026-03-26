'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const SKILL_SUGGESTIONS = [
  'Cold calling', 'LinkedIn outreach', 'Email marketing', 'CRM', 'Sales funnel',
  'Prospection B2B', 'Closing', 'Lead generation', 'Copywriting', 'Growth hacking',
  'Facebook Ads', 'Google Ads', 'SEO', 'SaaS', 'E-commerce', 'Coaching', 'Formation',
]

export default function EditProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) { router.push('/auth/login'); return }
        const p = data.user.profile
        if (p) {
          setName(p.name ?? '')
          setTitle(p.title ?? '')
          setBio(p.bio ?? '')
          setSkills(JSON.parse(p.skills ?? '[]'))
          setHourlyRate(p.hourlyRate?.toString() ?? '')
          setLocation(p.location ?? '')
          setWebsite(p.website ?? '')
          setAvailable(p.available ?? true)
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (s && !skills.includes(s)) {
      setSkills([...skills, s])
    }
    setSkillInput('')
  }

  const removeSkill = (s: string) => setSkills(skills.filter(x => x !== s))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const res = await fetch('/api/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title, bio, skills, hourlyRate, location, website, available }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erreur lors de la sauvegarde')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return (
    <>
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    </>
  )

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Mon profil</h1>
        <p className="text-gray-500 mb-8">Complétez votre profil pour attirer plus de connexions</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
            Profil mis à jour avec succès !
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="font-bold text-gray-900">Informations générales</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Localisation</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Paris, France"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre / Poste *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="Expert en prise de RDV B2B"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio *</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                required
                rows={4}
                placeholder="Parlez de votre expérience, vos résultats et ce que vous pouvez apporter..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="font-bold text-gray-900">Compétences</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                placeholder="Ajouter une compétence..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onClick={() => addSkill(skillInput)} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700">
                Ajouter
              </button>
            </div>
            {/* Suggestions */}
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 10).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 text-xs px-3 py-1.5 rounded-full transition"
                >
                  + {s}
                </button>
              ))}
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {skills.map(s => (
                  <span key={s} className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-sm px-3 py-1.5 rounded-full font-medium">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500 font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="font-bold text-gray-900">Tarification & disponibilité</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarif horaire (€)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  min={0}
                  placeholder="25"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Site web</label>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://monsite.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setAvailable(!available)}
                className={`w-11 h-6 rounded-full transition-colors ${available ? 'bg-green-500' : 'bg-gray-300'} relative`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${available ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {available ? 'Disponible pour de nouvelles collaborations' : 'Non disponible actuellement'}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
          </button>
        </form>
      </main>
    </>
  )
}
