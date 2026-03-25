import { NextRequest, NextResponse } from 'next/server'
import { sanity } from '@/lib/sanity'

export async function POST(req: NextRequest) {
  const { title, description } = await req.json() as {
    title: string
    description: string
  }

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const id = 'drafts.' + crypto.randomUUID().replace(/-/g, '').slice(0, 20)

  const doc: Record<string, unknown> = {
    _id: id,
    _type: 'curatedTourCollection',
    title,
    description: description || undefined,
    tours: [],
  }

  try {
    await sanity.createOrReplace(doc as any)
    return NextResponse.json({ _id: id, title })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create collection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
