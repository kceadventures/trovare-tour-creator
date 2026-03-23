import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseGPX } from '@/lib/gpx'
import { matchMediaToStops } from '@/lib/media-matcher'
import { POI_KINDS } from '@/lib/constants'
import type { UploadedFile, Stop, Tour, ProcessResult } from '@/lib/types'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: UploadedFile[] }

  const gpxFile = files.find(f => f.category === 'gpx')
  let trackPoints: { lat: number; lng: number; ts?: number }[] = []
  let waypoints: { name: string; lat: number; lng: number }[] = []
  let distance = 0
  let gpxFileId: string | undefined

  if (gpxFile) {
    gpxFileId = gpxFile.id
    const gpxRes = await fetch(gpxFile.url)
    const gpxXml = await gpxRes.text()
    const parsed = parseGPX(gpxXml)
    trackPoints = parsed.trackPoints
    waypoints = parsed.waypoints
    distance = parsed.distance
  }

  const stops: Stop[] = waypoints.map((wp) => ({
    id: crypto.randomUUID(),
    title: wp.name,
    kind: 'touristAttraction',
    details: '',
    lat: wp.lat,
    lng: wp.lng,
  }))

  const mediaFiles = files.filter(f => f.category !== 'gpx' && f.category !== 'text')
  const { matched, unmatched } = matchMediaToStops(mediaFiles, stops)

  for (const stop of stops) {
    const fileIds = matched.get(stop.id) || []
    for (const fid of fileIds) {
      const file = files.find(f => f.id === fid)
      if (!file) continue
      if (file.category === 'image' && !stop.imageId) stop.imageId = fid
      else if (file.category === 'audio' && !stop.audioId) stop.audioId = fid
      else if (file.category === 'video' && !stop.videoId) stop.videoId = fid
    }
  }

  const textFiles = files.filter(f => f.category === 'text')
  let textContext = ''
  for (const tf of textFiles) {
    const res = await fetch(tf.url)
    textContext += await res.text() + '\n'
  }

  const stopContext = stops.map((s, i) =>
    `Stop ${i + 1}: "${s.title}" at ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`
  ).join('\n')

  const systemPrompt = `You organize tour data for Go Trovare, a self-guided travel app.

Given a list of stops and optional text context from the creator, generate:
1. A tour title and description (markdown)
2. tourType: one of walk, bike, drive, run
3. categoryTag: one of food, culture, nature, history, adventure, scenic (or empty)
4. challengeLevel: 1 (easy), 2 (moderate), 3 (hard)
5. durationMin and durationMax in minutes
6. For each stop: a markdown description (2-3 paragraphs, warm second-person voice) and a "kind" from: ${POI_KINDS.join(', ')}

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...markdown...",
  "tourType": "walk",
  "categoryTag": "culture",
  "challengeLevel": 2,
  "durationMin": 60,
  "durationMax": 90,
  "stops": [
    { "index": 0, "details": "...markdown...", "kind": "touristAttraction" }
  ]
}`

  const userMessage = `Here are the stops:\n${stopContext}\n\nDistance: ${distance} miles.\n${textContext ? `\nCreator notes:\n${textContext}` : ''}\n\nSearch the web for real information about each stop before writing.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
    })

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map(c => c.text).join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const aiData = JSON.parse(jsonMatch[0])

      for (const aiStop of aiData.stops || []) {
        const stop = stops[aiStop.index]
        if (!stop) continue
        stop.details = aiStop.details || stop.details
        if (aiStop.kind && POI_KINDS.includes(aiStop.kind)) {
          stop.kind = aiStop.kind
        }
      }

      const tour: Tour = {
        title: aiData.title || 'Untitled Tour',
        description: aiData.description || '',
        tourType: aiData.tourType || 'walk',
        categoryTag: aiData.categoryTag || '',
        challengeLevel: Math.min(Math.max(aiData.challengeLevel || 2, 1), 3),
        durationRange: aiData.durationMax && aiData.durationMax !== aiData.durationMin
          ? [aiData.durationMin, aiData.durationMax]
          : [aiData.durationMin || 60],
        distance,
        regionId: '',
        tourProviderId: '',
        stops,
        routePoints: trackPoints,
        gpxFileId,
      }

      const result: ProcessResult = { tour, files, unmatchedFiles: unmatched }
      return NextResponse.json(result)
    }
  } catch (e) {
    console.error('AI processing error:', e)
  }

  const tour: Tour = {
    title: 'Untitled Tour',
    description: '',
    tourType: 'walk',
    categoryTag: '',
    challengeLevel: 2,
    durationRange: [60],
    distance,
    regionId: '',
    tourProviderId: '',
    stops,
    routePoints: trackPoints,
    gpxFileId,
  }

  return NextResponse.json({ tour, files, unmatchedFiles: unmatched } as ProcessResult)
}
