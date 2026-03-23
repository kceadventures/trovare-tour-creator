import { NextRequest, NextResponse } from 'next/server'
import { sanity, uploadSanityAsset } from '@/lib/sanity'
import { generateMapImage } from '@/lib/map-image'
import { checkTourDuplicates, checkPOIDuplicates } from '@/lib/duplicates'
import type { Tour, UploadedFile, PublishResult, DryRunOutput, DryRunDocument } from '@/lib/types'

const genId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20)

export async function POST(req: NextRequest) {
  const { tour, files, dryRun } = await req.json() as {
    tour: Tour; files: UploadedFile[]; dryRun?: boolean
  }

  const testingMode = dryRun || process.env.TESTING_MODE === 'true'
  const fileMap = new Map(files.map(f => [f.id, f]))

  const tourDupe = await checkTourDuplicates(tour.title)
  const poiDupes = await checkPOIDuplicates(tour.stops)

  const poiDocs: DryRunDocument[] = []
  const assets: DryRunOutput['assets'] = []
  const references: DryRunOutput['references'] = []
  const warnings: string[] = []

  if (tourDupe) warnings.push(tourDupe.message)
  for (const [, warning] of poiDupes) {
    warnings.push(warning.message)
  }

  for (const stop of tour.stops) {
    const poiId = 'drafts.' + genId()

    let previewRef: Record<string, unknown> | undefined
    if (stop.imageId) {
      const imgFile = fileMap.get(stop.imageId)
      if (imgFile) {
        if (!testingMode) {
          const imgRes = await fetch(imgFile.url)
          const imgBuf = Buffer.from(await imgRes.arrayBuffer())
          const assetId = await uploadSanityAsset(imgBuf, 'image', imgFile.originalName, 'image/jpeg')
          previewRef = { _type: 'image', asset: { _type: 'reference', _ref: assetId } }
        }
        assets.push({ filename: imgFile.originalName, type: 'image', size: imgFile.size, destination: 'Sanity CDN' })
      }
    } else {
      warnings.push(`Stop "${stop.title}" has no image assigned`)
    }

    let audioUpload: Record<string, unknown> | undefined
    if (stop.audioId) {
      const audioFile = fileMap.get(stop.audioId)
      if (audioFile) {
        audioUpload = {
          _type: 'r2.asset',
          filename: audioFile.originalName,
          filesize: audioFile.size,
          fileType: audioFile.mimeType,
          assetKey: audioFile.url,
          url: audioFile.url,
        }
      }
    }

    let videoUpload: Record<string, unknown> | undefined
    if (stop.videoId) {
      const videoFile = fileMap.get(stop.videoId)
      if (videoFile) {
        videoUpload = {
          _type: 'r2.asset',
          filename: videoFile.originalName,
          filesize: videoFile.size,
          fileType: videoFile.mimeType,
          assetKey: videoFile.url,
          url: videoFile.url,
        }
      }
    }

    const poiDoc: DryRunDocument = {
      _id: poiId,
      _type: 'pointOfInterest',
      title: stop.title,
      kind: stop.kind || undefined,
      details: stop.details,
      location: { _type: 'geopoint', lat: stop.lat, lng: stop.lng },
      ...(previewRef ? { preview: previewRef } : {}),
      ...(audioUpload ? { audioUpload } : {}),
      ...(videoUpload ? { videoUpload } : {}),
    }

    poiDocs.push(poiDoc)
    references.push({ from: 'tour', to: poiId, field: 'pointsOfInterest' })
  }

  let routeFileRef: Record<string, unknown> | undefined
  if (tour.gpxFileId) {
    const gpxFile = fileMap.get(tour.gpxFileId)
    if (gpxFile) {
      if (!testingMode) {
        const gpxRes = await fetch(gpxFile.url)
        const gpxBuf = Buffer.from(await gpxRes.arrayBuffer())
        const assetId = await uploadSanityAsset(gpxBuf, 'file', gpxFile.originalName, 'application/gpx+xml')
        routeFileRef = { _type: 'file', asset: { _type: 'reference', _ref: assetId } }
      }
      assets.push({ filename: gpxFile.originalName, type: 'file', size: gpxFile.size, destination: 'Sanity CDN' })
    }
  }

  let mapImageRef: Record<string, unknown> | undefined
  const mapBuf = await generateMapImage(
    tour.routePoints,
    tour.stops.map((s, i) => ({ lat: s.lat, lng: s.lng, index: i }))
  )
  if (!testingMode) {
    const assetId = await uploadSanityAsset(mapBuf, 'image', `${tour.title.replace(/\s+/g, '-').toLowerCase()}-map.png`, 'image/png')
    mapImageRef = { _type: 'image', asset: { _type: 'reference', _ref: assetId } }
  }
  assets.push({ filename: 'map.png', type: 'image', size: mapBuf.length, destination: 'Sanity CDN' })

  const tourId = 'drafts.' + genId()
  const tourDoc: DryRunDocument = {
    _id: tourId,
    _type: 'tour',
    title: tour.title,
    description: tour.description,
    tourType: tour.tourType,
    categoryTag: tour.categoryTag || undefined,
    challengeLevel: tour.challengeLevel,
    distance: tour.distance,
    durationRange: tour.durationRange,
    ...(routeFileRef ? { routeFile: routeFileRef } : {}),
    ...(mapImageRef ? { mapImage: mapImageRef } : {}),
    pointsOfInterest: poiDocs.map(p => ({
      _type: 'reference', _ref: p._id, _key: (p._id as string).slice(-10),
    })),
  }

  if (tour.regionId) {
    tourDoc.relatedRegions = [{ _type: 'reference', _ref: tour.regionId, _key: tour.regionId.slice(0, 8) }]
    references.push({ from: tourId, to: tour.regionId, field: 'relatedRegions' })
  }
  if (tour.tourProviderId) {
    tourDoc.tourProvider = { _type: 'reference', _ref: tour.tourProviderId }
    references.push({ from: tourId, to: tour.tourProviderId, field: 'tourProvider' })
  }

  if (testingMode) {
    const dryRunOutput: DryRunOutput = {
      documents: [...poiDocs, tourDoc],
      assets,
      references,
      warnings,
    }
    return NextResponse.json({ success: true, dryRun: dryRunOutput } as PublishResult)
  }

  try {
    const transaction = sanity.transaction()
    for (const doc of poiDocs) {
      transaction.createOrReplace(doc as any)
    }
    transaction.createOrReplace(tourDoc as any)
    await transaction.commit()

    return NextResponse.json({
      success: true,
      studioUrl: 'https://trovare-prod.vercel.app/structure',
    } as PublishResult)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message } as PublishResult, { status: 500 })
  }
}
