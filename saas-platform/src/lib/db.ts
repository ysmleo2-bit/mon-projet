import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const envUrl = process.env.DATABASE_URL
  const absDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')

  let url: string
  if (!envUrl || envUrl.startsWith('file:')) {
    // Always use absolute path for local SQLite
    url = `file://${absDbPath}`
  } else {
    // Turso/libsql cloud URL (libsql://...)
    url = envUrl
  }

  const adapter = new PrismaLibSql({ url })
  _prisma = new PrismaClient({ adapter })
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
