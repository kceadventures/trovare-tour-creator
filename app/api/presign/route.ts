import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUploadUrl } from '@/lib/spaces'
import { FILE_LIMITS } from '@/lib/constants'
import type { FileCategory } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { filename, contentType, size, category } = await req.json() as {
    filename: string; contentType: string; size: number; category: FileCategory
  }

  const limit = FILE_LIMITS[category]
  if (size > limit) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(limit / 1024 / 1024)}MB for ${category}` },
      { status: 413 }
    )
  }

  const uploadId = crypto.randomUUID()
  const key = `staging/${uploadId}/${filename}`
  const presignedUrl = await getPresignedUploadUrl(key, contentType)

  return NextResponse.json({ presignedUrl, key, uploadId })
}
