export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, batch } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const withUser = searchParams.get('with')

    if (withUser) {
      // Mark messages from the other user as read, fetch thread
      const [, msgRows] = await batch([
        {
          sql: 'UPDATE "Message" SET read=1 WHERE senderId=? AND receiverId=? AND read=0',
          args: [withUser, auth.userId],
        },
        {
          sql: `SELECT id, senderId, receiverId, content, read, createdAt
                FROM "Message"
                WHERE (senderId=? AND receiverId=?) OR (senderId=? AND receiverId=?)
                ORDER BY createdAt ASC`,
          args: [auth.userId, withUser, withUser, auth.userId],
        },
      ])

      return NextResponse.json({ messages: msgRows })
    }

    // Conversation list: get all messages involving this user, build one entry per peer
    const allMsgs = await query(
      `SELECT m.id, m.senderId, m.receiverId, m.content, m.read, m.createdAt,
              sp.name as senderName, sp.avatar as senderAvatar,
              rp.name as receiverName, rp.avatar as receiverAvatar
       FROM "Message" m
       LEFT JOIN "Profile" sp ON sp.userId = m.senderId
       LEFT JOIN "Profile" rp ON rp.userId = m.receiverId
       WHERE m.senderId = ? OR m.receiverId = ?
       ORDER BY m.createdAt DESC`,
      [auth.userId, auth.userId]
    )

    // Build conversation map: one entry per peer (messages are already sorted newest first)
    const convMap = new Map<
      string,
      { userId: string; name: string | null; avatar: string | null; lastMessage: string; unread: number; updatedAt: string }
    >()

    for (const m of allMsgs) {
      const isSender = m.senderId === auth.userId
      const peerId = (isSender ? m.receiverId : m.senderId) as string

      if (!convMap.has(peerId)) {
        convMap.set(peerId, {
          userId: peerId,
          name: (isSender ? m.receiverName : m.senderName) as string | null,
          avatar: (isSender ? m.receiverAvatar : m.senderAvatar) as string | null,
          lastMessage: m.content as string,
          unread: 0,
          updatedAt: m.createdAt as string,
        })
      }
      // Count unread: messages received (not sent) that are unread
      if (!isSender && !m.read) {
        convMap.get(peerId)!.unread += 1
      }
    }

    const conversations = Array.from(convMap.values())

    return NextResponse.json({ conversations })
  } catch (e) {
    console.error('[messages GET]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { receiverId, content } = await request.json()
    if (!receiverId || !content?.trim()) {
      return NextResponse.json({ error: 'Destinataire et contenu requis' }, { status: 400 })
    }

    const msgId = crypto.randomUUID()
    const now = new Date().toISOString()

    await query(
      'INSERT INTO "Message" (id, content, senderId, receiverId, read, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
      [msgId, content.trim(), auth.userId, receiverId, now]
    )

    return NextResponse.json(
      { message: { id: msgId, content: content.trim(), senderId: auth.userId, receiverId, read: false, createdAt: now } },
      { status: 201 }
    )
  } catch (e) {
    console.error('[messages POST]', e)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(e) }, { status: 500 })
  }
}
