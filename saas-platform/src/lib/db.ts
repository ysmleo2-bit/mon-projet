import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import { fileURLToPath } from 'url'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const envUrl = process.env.DATABASE_URL

  let url: string
  if (!envUrl || envUrl.startsWith('file:')) {
    // Use import.meta.url so the path is always relative to THIS file,
    // not to process.cwd() (which Turbopack may change to the workspace root).
    // This file is at: <project>/src/lib/db.ts
    // DB is at:        <project>/prisma/dev.db
    const thisDir = path.dirname(fileURLToPath(import.meta.url))
    const absDbPath = path.resolve(thisDir, '..', '..', 'prisma', 'dev.db')
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
