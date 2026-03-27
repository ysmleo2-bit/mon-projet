import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import { fileURLToPath } from 'url'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const envUrl = process.env.DATABASE_URL

  let url: string
  let authToken: string | undefined

  if (!envUrl || envUrl.startsWith('file:')) {
    // Local dev: resolve path relative to this file (immune to Turbopack cwd changes)
    // This file: <project>/src/lib/db.ts  →  DB: <project>/prisma/dev.db
    const thisDir = path.dirname(fileURLToPath(import.meta.url))
    const absDbPath = path.resolve(thisDir, '..', '..', 'prisma', 'dev.db')
    url = `file://${absDbPath}`
  } else {
    // Production: Turso cloud (libsql://...)
    url = envUrl
    authToken = process.env.TURSO_AUTH_TOKEN
  }

  const adapter = new PrismaLibSql({ url, authToken })
  _prisma = new PrismaClient({ adapter })
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
