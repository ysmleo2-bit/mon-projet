export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

function safeJson(s: string, fallback: unknown) {
  try { return JSON.parse(s) } catch { return fallback }
}

export async function GET() {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const rows = await query(
      `SELECT u.id, u.email, u.role,
              p.id as profileId, p.name, p.avatar, p.title, p.bio,
              p.skills, p.hourlyRate, p.location, p.website, p.available
       FROM "User" u
       LEFT JOIN "Profile" p ON p.userId = u.id
       WHERE u.id = ?`,
      [auth.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const row = rows[0]
    const profile = row.profileId
      ? {
          id: row.profileId,
          userId: row.id,
          name: row.name,
          avatar: row.avatar,
          title: row.title,
          bio: row.bio,
          skills: safeJson(row.skills as string, []),
          hourlyRate: row.hourlyRate,
          location: row.location,
          website: row.website,
          available: row.available === 1 || row.available === true,
        }
      : null

    return NextResponse.json({
      user: { id: row.id, email: row.email, role: row.role, profile },
    })
  } catch (e) {
    console.error('[me]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('token')
  return response
}
