import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaPg } from '@prisma/adapter-pg'
import path from 'path'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const defaultSqlite = `file:${path.resolve(process.cwd(), 'prisma', 'dev.db')}`
  const url = process.env.DATABASE_URL ?? defaultSqlite

  if (url.startsWith('file:')) {
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')
    const adapter = new PrismaLibSql({ url: `file://${dbPath}` })
    _prisma = new PrismaClient({ adapter })
  } else {
    const adapter = new PrismaPg({ connectionString: url })
    _prisma = new PrismaClient({ adapter })
  }

  return _prisma
}

// Convenience export — same instance after first call
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
