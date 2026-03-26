export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const withUser = searchParams.get('with')

  if (withUser) {
    // Mark messages as read
    await prisma.message.updateMany({
      where: { senderId: withUser, receiverId: auth.userId, read: false },
      data: { read: true },
    })

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: auth.userId, receiverId: withUser },
          { senderId: withUser, receiverId: auth.userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ messages })
  }

  // Return conversation list (latest message per user)
  const sent = await prisma.message.findMany({
    where: { senderId: auth.userId },
    include: { receiver: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
    distinct: ['receiverId'],
  })

  const received = await prisma.message.findMany({
    where: { receiverId: auth.userId },
    include: { sender: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
    distinct: ['senderId'],
  })

  // Merge into unique conversations
  const convMap = new Map<string, { userId: string; name: string; avatar: string | null; lastMessage: string; unread: number; updatedAt: Date }>()

  for (const m of sent) {
    const id = m.receiverId
    if (!convMap.has(id)) {
      convMap.set(id, {
        userId: id,
        name: m.receiver.profile?.name ?? m.receiver.email,
        avatar: m.receiver.profile?.avatar ?? null,
        lastMessage: m.content,
        unread: 0,
        updatedAt: m.createdAt,
      })
    }
  }

  for (const m of received) {
    const id = m.senderId
    if (!convMap.has(id)) {
      const unread = await prisma.message.count({
        where: { senderId: id, receiverId: auth.userId, read: false },
      })
      convMap.set(id, {
        userId: id,
        name: m.sender.profile?.name ?? m.sender.email,
        avatar: m.sender.profile?.avatar ?? null,
        lastMessage: m.content,
        unread,
        updatedAt: m.createdAt,
      })
    }
  }

  const conversations = Array.from(convMap.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )

  return NextResponse.json({ conversations })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { receiverId, content } = await request.json()
  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: 'Destinataire et contenu requis' }, { status: 400 })
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      senderId: auth.userId,
      receiverId,
    },
  })

  return NextResponse.json({ message }, { status: 201 })
}
