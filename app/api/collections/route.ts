import { NextResponse } from 'next/server'
import { fetchCollections } from '@/lib/sanity'

export async function GET() {
  try {
    const collections = await fetchCollections()
    return NextResponse.json(collections)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch collections'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
