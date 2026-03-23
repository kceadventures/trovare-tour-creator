import { NextResponse } from 'next/server'
import { fetchRegions } from '@/lib/sanity'

export async function GET() {
  try {
    const regions = await fetchRegions()
    return NextResponse.json(regions)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch regions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
