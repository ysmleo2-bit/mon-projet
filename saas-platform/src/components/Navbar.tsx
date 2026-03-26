'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  role: string
  profile?: { name: string } | null
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.user ? setUser(data.user) : setUser(null))
      .catch(() => setUser(null))
  }, [pathname])

  const logout = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' })
    setUser(null)
    router.push('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SL</span>
            </div>
            <span className="font-bold text-xl text-gray-900">SetterLink</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <Link href="/browse" className="text-gray-600 hover:text-indigo-600 font-medium text-sm">
                  Parcourir
                </Link>
                <Link href="/messages" className="text-gray-600 hover:text-indigo-600 font-medium text-sm">
                  Messages
                </Link>
                <Link href="/dashboard" className="text-gray-600 hover:text-indigo-600 font-medium text-sm">
                  Tableau de bord
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {(user.profile?.name ?? user.email)[0].toUpperCase()}
                      </span>
                    </div>
                    {user.profile?.name ?? user.email.split('@')[0]}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <Link
                        href="/profile/edit"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Mon profil
                      </Link>
                      <button
                        onClick={() => { setMenuOpen(false); logout() }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-600 hover:text-indigo-600 font-medium text-sm">
                  Connexion
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-600"></div>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {user ? (
              <>
                <Link href="/browse" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Parcourir</Link>
                <Link href="/messages" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Messages</Link>
                <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Tableau de bord</Link>
                <Link href="/profile/edit" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Mon profil</Link>
                <button onClick={logout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Déconnexion</button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Connexion</Link>
                <Link href="/auth/register" className="block px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg">S&apos;inscrire</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
