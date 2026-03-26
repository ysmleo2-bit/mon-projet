export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const profile = await prisma.profile.findFirst({
    where: { OR: [{ id }, { userId: id }] },
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
