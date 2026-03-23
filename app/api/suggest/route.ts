import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Log suggestions for now — can be routed to Sanity, email, or a database later
  console.log('[SUGGESTION]', JSON.stringify(body, null, 2))
  return NextResponse.json({ ok: true })
}
