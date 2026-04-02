export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const rawUrl = process.env.DATABASE_URL ?? 'NOT_SET'
  const token = process.env.TURSO_AUTH_TOKEN ?? 'NOT_SET'
  const url = rawUrl.replace(/^libsql:\/\//, 'https://')

  try {
    const res = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql: 'SELECT 1 as ok', args: [] } },
          { type: 'close' },
        ],
      }),
    })

    const text = await res.text()
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      url: url.substring(0, 40) + '...',
      token_length: token.length,
      raw_url_prefix: rawUrl.substring(0, 20),
      body: text.substring(0, 500),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
