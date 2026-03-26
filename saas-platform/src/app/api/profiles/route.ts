export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const search = searchParams.get('search')
  const available = searchParams.get('available')

  const where: Record<string, unknown> = {}

  if (role) {
    where.user = { role }
  }

  if (available === 'true') {
    where.available = true
  }

  const profiles = await prisma.profile.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const filtered = search
    ? profiles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.bio.toLowerCase().includes(search.toLowerCase())
      )
    : profiles

  return NextResponse.json({ profiles: filtered })
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json()
  const { name, title, bio, skills, hourlyRate, location, website, available } = body

  const profile = await prisma.profile.update({
    where: { userId: auth.userId },
    data: {
      name,
      title,
      bio,
      skills: JSON.stringify(skills || []),
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      location,
      website,
      available: available ?? true,
    },
  })

  return NextResponse.json({ profile })
}
