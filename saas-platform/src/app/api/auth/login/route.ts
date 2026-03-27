export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    const rows = await query(
      `SELECT u.id, u.email, u.password, u.role,
              p.id as profileId, p.name, p.avatar, p.title, p.bio,
              p.skills, p.hourlyRate, p.location, p.website, p.available
       FROM "User" u
       LEFT JOIN "Profile" p ON p.userId = u.id
       WHERE u.email = ?`,
      [email]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    }

    const row = rows[0]
    const valid = await bcrypt.compare(password, row.password as string)
    if (!valid) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    }

    const userId = row.id as string
    const role = row.role as string
    const token = signToken({ userId, email: row.email as string, role })

    const profile = row.profileId
      ? {
          id: row.profileId,
          userId,
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

    const response = NextResponse.json({
      user: { id: userId, email: row.email, role, profile },
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (e) {
    console.error('[login]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

function safeJson(s: string, fallback: unknown) {
  try { return JSON.parse(s) } catch { return fallback }
}
