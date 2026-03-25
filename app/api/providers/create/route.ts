import { NextRequest, NextResponse } from 'next/server'
import { sanity } from '@/lib/sanity'

export async function POST(req: NextRequest) {
  const { name, email, description, website } = await req.json() as {
    name: string
    email: string
    description: string
    website: string
  }

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const id = 'drafts.' + crypto.randomUUID().replace(/-/g, '').slice(0, 20)

  // Store email in description as a note for reviewers
  const descWithEmail = [
    description,
    '',
    `---`,
    `Contact email: ${email}`,
    `Status: Pending verification`,
  ].filter(Boolean).join('\n')

  const doc: Record<string, unknown> = {
    _id: id,
    _type: 'tourProvider',
    title: name,
    description: descWithEmail,
  }

  if (website) {
    doc.social = [website]
  }

  try {
    await sanity.createOrReplace(doc as any)
    return NextResponse.json({ _id: id, title: name })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create provider'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
