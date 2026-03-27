import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')

  const pool = new pg.Pool({ connectionString: url })
  const adapter = new PrismaPg(pool)
  _prisma = new PrismaClient({ adapter })
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
