import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import { fileURLToPath } from 'url'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const envUrl = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  let url: string

  if (!envUrl || envUrl.startsWith('file:')) {
    // Local dev: resolve path relative to this file (immune to Turbopack cwd changes)
    const thisDir = path.dirname(fileURLToPath(import.meta.url))
    const absDbPath = path.resolve(thisDir, '..', '..', 'prisma', 'dev.db')
    url = `file://${absDbPath}`
  } else {
    // Production Turso: force https:// so the HTTP client is used (not WebSockets)
    url = envUrl.replace(/^libsql:\/\//, 'https://')
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
