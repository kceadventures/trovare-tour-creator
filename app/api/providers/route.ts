import { NextResponse } from 'next/server'
import { fetchTourProviders } from '@/lib/sanity'

export async function GET() {
  try {
    const providers = await fetchTourProviders()
    return NextResponse.json(providers)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch providers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
