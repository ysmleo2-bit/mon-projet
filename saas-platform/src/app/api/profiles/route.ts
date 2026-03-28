export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

function safeJson(s: string, fallback: unknown) {
  try { return JSON.parse(s) } catch { return fallback }
}

function shapeProfile(row: Record<string, unknown>) {
  return {
    id: row.profileId ?? row.id,
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
    user: {
      id: row.uId ?? row.userId,
      email: row.email,
      role: row.role,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    const available = searchParams.get('available')

    let sql = `
      SELECT p.id as profileId, p.userId, p.name, p.avatar, p.title, p.bio,
             p.skills, p.hourlyRate, p.location, p.website, p.available,
             p.createdAt, p.updatedAt,
             u.id as uId, u.email, u.role
      FROM "Profile" p
      JOIN "User" u ON u.id = p.userId
      WHERE 1=1`
    const args: unknown[] = []

    if (role) {
      sql += ' AND u.role = ?'
      args.push(role)
    }
    if (available === 'true') {
      sql += ' AND p.available = 1'
    }

    sql += ' ORDER BY p.updatedAt DESC'

    let rows = await query(sql, args)

    if (search) {
      const s = search.toLowerCase()
      rows = rows.filter(
        r =>
          String(r.name ?? '').toLowerCase().includes(s) ||
          String(r.title ?? '').toLowerCase().includes(s) ||
          String(r.bio ?? '').toLowerCase().includes(s)
      )
    }

    return NextResponse.json({ profiles: rows.map(shapeProfile) })
  } catch (e) {
    console.error('[profiles GET]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { name, title, bio, skills, hourlyRate, location, website, available } = body
    const now = new Date().toISOString()

    await query(
      `UPDATE "Profile" SET name=?, title=?, bio=?, skills=?, hourlyRate=?, location=?, website=?, available=?, updatedAt=?
       WHERE userId=?`,
      [
        name,
        title,
        bio,
        JSON.stringify(skills || []),
        hourlyRate ? parseFloat(hourlyRate) : null,
        location ?? null,
        website ?? null,
        available ?? true ? 1 : 0,
        now,
        auth.userId,
      ]
    )

    const rows = await query(
      `SELECT p.id as profileId, p.userId, p.name, p.avatar, p.title, p.bio,
              p.skills, p.hourlyRate, p.location, p.website, p.available,
              p.createdAt, p.updatedAt,
              u.id as uId, u.email, u.role
       FROM "Profile" p JOIN "User" u ON u.id = p.userId
       WHERE p.userId = ?`,
      [auth.userId]
    )

    return NextResponse.json({ profile: rows.length > 0 ? shapeProfile(rows[0]) : null })
  } catch (e) {
    console.error('[profiles PUT]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}
