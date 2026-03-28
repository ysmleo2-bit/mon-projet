export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, batch } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

function safeJson(s: string, fallback: unknown) {
  try { return JSON.parse(s) } catch { return fallback }
}

function shapeUserWithProfile(prefix: string, row: Record<string, unknown>) {
  const hasProfile = row[`${prefix}_profileId`] != null
  return {
    id: row[`${prefix}_id`],
    email: row[`${prefix}_email`],
    role: row[`${prefix}_role`],
    profile: hasProfile
      ? {
          id: row[`${prefix}_profileId`],
          userId: row[`${prefix}_id`],
          name: row[`${prefix}_name`],
          avatar: row[`${prefix}_avatar`] ?? null,
          title: row[`${prefix}_title`],
          bio: row[`${prefix}_bio`],
          skills: safeJson(row[`${prefix}_skills`] as string, []),
          hourlyRate: row[`${prefix}_hourlyRate`] ?? null,
          location: row[`${prefix}_location`] ?? null,
          website: row[`${prefix}_website`] ?? null,
          available: row[`${prefix}_available`] === 1 || row[`${prefix}_available`] === true,
        }
      : null,
  }
}

const CONNECTION_JOIN_SQL = `
  SELECT c.id, c.fromId, c.toId, c.status, c.createdAt,
    fu.id as f_id, fu.email as f_email, fu.role as f_role,
    fp.id as f_profileId, fp.name as f_name, fp.avatar as f_avatar, fp.title as f_title,
    fp.bio as f_bio, fp.skills as f_skills, fp.hourlyRate as f_hourlyRate,
    fp.location as f_location, fp.website as f_website, fp.available as f_available,
    tu.id as t_id, tu.email as t_email, tu.role as t_role,
    tp.id as t_profileId, tp.name as t_name, tp.avatar as t_avatar, tp.title as t_title,
    tp.bio as t_bio, tp.skills as t_skills, tp.hourlyRate as t_hourlyRate,
    tp.location as t_location, tp.website as t_website, tp.available as t_available
  FROM "Connection" c
  JOIN "User" fu ON fu.id = c.fromId
  LEFT JOIN "Profile" fp ON fp.userId = c.fromId
  JOIN "User" tu ON tu.id = c.toId
  LEFT JOIN "Profile" tp ON tp.userId = c.toId`

function shapeConnection(row: Record<string, unknown>) {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    status: row.status,
    createdAt: row.createdAt,
    from: shapeUserWithProfile('f', row),
    to: shapeUserWithProfile('t', row),
  }
}

export async function GET() {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const rows = await query(
      `${CONNECTION_JOIN_SQL}
       WHERE c.fromId = ? OR c.toId = ?
       ORDER BY c.createdAt DESC`,
      [auth.userId, auth.userId]
    )

    return NextResponse.json({ connections: rows.map(shapeConnection) })
  } catch (e) {
    console.error('[connections GET]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { toId } = await request.json()
    if (!toId) {
      return NextResponse.json({ error: 'toId requis' }, { status: 400 })
    }
    if (toId === auth.userId) {
      return NextResponse.json({ error: 'Impossible de se connecter à soi-même' }, { status: 400 })
    }

    const existing = await query(
      `SELECT id FROM "Connection" WHERE (fromId=? AND toId=?) OR (fromId=? AND toId=?)`,
      [auth.userId, toId, toId, auth.userId]
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Connexion déjà existante' }, { status: 409 })
    }

    const connectionId = crypto.randomUUID()
    const now = new Date().toISOString()

    await batch([
      {
        sql: 'INSERT INTO "Connection" (id, fromId, toId, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        args: [connectionId, auth.userId, toId, 'pending', now],
      },
    ])

    const rows = await query(
      `${CONNECTION_JOIN_SQL} WHERE c.id = ?`,
      [connectionId]
    )

    return NextResponse.json(
      { connection: rows.length > 0 ? shapeConnection(rows[0]) : null },
      { status: 201 }
    )
  } catch (e) {
    console.error('[connections POST]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { connectionId, status } = await request.json()
    if (!connectionId || !['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    const existing = await query(
      'SELECT id FROM "Connection" WHERE id=? AND toId=?',
      [connectionId, auth.userId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Connexion introuvable' }, { status: 404 })
    }

    await query('UPDATE "Connection" SET status=? WHERE id=?', [status, connectionId])

    const rows = await query(`${CONNECTION_JOIN_SQL} WHERE c.id = ?`, [connectionId])

    return NextResponse.json({ connection: rows.length > 0 ? shapeConnection(rows[0]) : null })
  } catch (e) {
    console.error('[connections PATCH]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}
