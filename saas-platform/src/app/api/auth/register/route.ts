export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, batch } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, role, name, title, bio } = body

    if (!email || !password || !role || !name || !title || !bio) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
    }

    if (!['setter', 'entrepreneur'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const existing = await query('SELECT id FROM "User" WHERE email = ?', [email])
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const userId = crypto.randomUUID()
    const profileId = crypto.randomUUID()
    const now = new Date().toISOString()

    await batch([
      {
        sql: 'INSERT INTO "User" (id, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [userId, email, hashed, role, now, now],
      },
      {
        sql: 'INSERT INTO "Profile" (id, userId, name, title, bio, skills, available, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
        args: [profileId, userId, name, title, bio, '[]', now, now],
      },
    ])

    const token = signToken({ userId, email, role })

    const response = NextResponse.json(
      {
        user: {
          id: userId,
          email,
          role,
          profile: { id: profileId, userId, name, title, bio, skills: [], available: true },
        },
      },
      { status: 201 }
    )

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}
