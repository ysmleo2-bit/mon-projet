import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ fromId: auth.userId }, { toId: auth.userId }],
    },
    include: {
      from: { include: { profile: true } },
      to: { include: { profile: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ connections })
}

export async function POST(request: NextRequest) {
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

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { fromId: auth.userId, toId },
        { fromId: toId, toId: auth.userId },
      ],
    },
  })

  if (existing) {
    return NextResponse.json({ error: 'Connexion déjà existante' }, { status: 409 })
  }

  const connection = await prisma.connection.create({
    data: { fromId: auth.userId, toId, status: 'pending' },
    include: {
      from: { include: { profile: true } },
      to: { include: { profile: true } },
    },
  })

  return NextResponse.json({ connection }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { connectionId, status } = await request.json()
  if (!connectionId || !['accepted', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const connection = await prisma.connection.findFirst({
    where: { id: connectionId, toId: auth.userId },
  })

  if (!connection) {
    return NextResponse.json({ error: 'Connexion introuvable' }, { status: 404 })
  }

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status },
  })

  return NextResponse.json({ connection: updated })
}
