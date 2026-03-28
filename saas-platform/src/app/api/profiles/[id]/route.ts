export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

function safeJson(s: string, fallback: unknown) {
  try { return JSON.parse(s) } catch { return fallback }
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    const rows = await query(
      `SELECT p.id as profileId, p.userId, p.name, p.avatar, p.title, p.bio,
              p.skills, p.hourlyRate, p.location, p.website, p.available,
              p.createdAt, p.updatedAt,
              u.id as uId, u.email, u.role
       FROM "Profile" p
       JOIN "User" u ON u.id = p.userId
       WHERE p.id = ? OR p.userId = ?
       LIMIT 1`,
      [id, id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const row = rows[0]
    const profile = {
      id: row.profileId,
      userId: row.userId,
      name: row.name,
      avatar: row.avatar ?? null,
      title: row.title,
      bio: row.bio,
      skills: safeJson(row.skills as string, []),
      hourlyRate: row.hourlyRate ?? null,
      location: row.location ?? null,
      website: row.website ?? null,
      available: row.available === 1 || row.available === true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: { id: row.uId, email: row.email, role: row.role },
    }

    return NextResponse.json({ profile })
  } catch (e) {
    console.error('[profiles/[id] GET]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}
