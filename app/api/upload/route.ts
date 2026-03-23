import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import exifr from 'exifr'
import { uploadToSpaces } from '@/lib/spaces'
import { FILE_LIMITS, ACCEPTED_TYPES } from '@/lib/constants'
import type { UploadedFile, FileCategory } from '@/lib/types'

function categorizeFile(filename: string): FileCategory | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  for (const [cat, exts] of Object.entries(ACCEPTED_TYPES)) {
    if (exts.includes(ext)) return cat as FileCategory
  }
  return null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const category = categorizeFile(file.name)
  if (!category) return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 })

  const limit = FILE_LIMITS[category]
  if (file.size > limit) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(limit / 1024 / 1024)}MB for ${category}` },
      { status: 413 }
    )
  }

  const arrayBuf = await file.arrayBuffer()
  const buffer = Buffer.from(new Uint8Array(arrayBuf))
  const id = crypto.randomUUID()

  let exifGps: { lat: number; lng: number } | undefined
  let uploadBuffer: Buffer = buffer
  let contentType = file.type
  let finalFilename = file.name

  if (category === 'image') {
    try {
      const gps = await exifr.gps(buffer)
      if (gps?.latitude && gps?.longitude) {
        exifGps = { lat: gps.latitude, lng: gps.longitude }
      }
    } catch { /* no EXIF */ }

    uploadBuffer = await sharp(buffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    contentType = 'image/jpeg'
    finalFilename = file.name.replace(/\.[^.]+$/, '.jpg')
  }

  const key = `staging/${id}/${finalFilename}`
  const url = await uploadToSpaces(key, uploadBuffer, contentType)

  const result: UploadedFile = {
    id,
    originalName: file.name,
    category,
    url,
    size: uploadBuffer.length,
    mimeType: contentType,
    exifGps,
  }

  return NextResponse.json(result)
}
