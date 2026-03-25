import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { parseGPX } from '@/lib/gpx'
import { matchMediaToStops } from '@/lib/media-matcher'
import { POI_KINDS } from '@/lib/constants'
import type { UploadedFile, Stop, Tour, ProcessResult } from '@/lib/types'

const anthropic = new Anthropic()

function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: { type: string; message?: string; progress?: number; result?: ProcessResult }
) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
}

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: UploadedFile[] }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Parse GPX (0-10%)
        sendEvent(controller, encoder, { type: 'status', message: 'Parsing GPX route file...', progress: 5 })

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
          sendEvent(controller, encoder, {
            type: 'status',
            message: `Found ${waypoints.length} waypoints, ${trackPoints.length} track points, ${distance} miles`,
            progress: 10,
          })
        } else {
          sendEvent(controller, encoder, { type: 'status', message: 'No GPX file found — stops must be added manually', progress: 10 })
        }

        // Step 2: Build stops + match media (10-25%)
        sendEvent(controller, encoder, { type: 'status', message: 'Building stops from waypoints...', progress: 15 })

        const stops: Stop[] = waypoints.map((wp) => ({
          id: crypto.randomUUID(),
          title: wp.name,
          kind: 'touristAttraction',
          details: '',
          lat: wp.lat,
          lng: wp.lng,
        }))

        const mediaFiles = files.filter(f => f.category !== 'gpx' && f.category !== 'text')
        sendEvent(controller, encoder, { type: 'status', message: `Matching ${mediaFiles.length} media files to ${stops.length} stops...`, progress: 18 })

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

        const matchedCount = mediaFiles.length - unmatched.length
        sendEvent(controller, encoder, {
          type: 'status',
          message: `Matched ${matchedCount} of ${mediaFiles.length} media files${unmatched.length ? ` (${unmatched.length} unmatched)` : ''}`,
          progress: 25,
        })

        // Step 3: Read text context (25-30%)
        const textFiles = files.filter(f => f.category === 'text')
        let textContext = ''
        const documentBlocks: Anthropic.Messages.DocumentBlockParam[] = []
        if (textFiles.length) {
          sendEvent(controller, encoder, { type: 'status', message: `Reading ${textFiles.length} text file(s) for context...`, progress: 27 })
          for (const tf of textFiles) {
            const name = tf.originalName.toLowerCase()
            if (name.endsWith('.pdf')) {
              // Pass PDF as base64 document block for Claude to read natively
              const res = await fetch(tf.url)
              const buf = await res.arrayBuffer()
              const base64 = Buffer.from(buf).toString('base64')
              documentBlocks.push({
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              })
              sendEvent(controller, encoder, { type: 'status', message: `Loaded PDF: ${tf.originalName}`, progress: 28 })
            } else if (name.endsWith('.docx')) {
              // Extract text from docx using mammoth
              const res = await fetch(tf.url)
              const buf = Buffer.from(await res.arrayBuffer())
              const result = await mammoth.extractRawText({ buffer: buf })
              textContext += `--- ${tf.originalName} ---\n${result.value}\n\n`
              sendEvent(controller, encoder, { type: 'status', message: `Extracted text from: ${tf.originalName}`, progress: 28 })
            } else {
              const res = await fetch(tf.url)
              textContext += await res.text() + '\n'
            }
          }
        }

        sendEvent(controller, encoder, { type: 'status', message: 'Sending to AI for research and writing...', progress: 30 })

        // Step 4: AI processing (30-95%)
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

        const userText = `Here are the stops:\n${stopContext}\n\nDistance: ${distance} miles.\n${textContext ? `\nCreator notes:\n${textContext}` : ''}\n\nSearch the web for real information about each stop before writing.`

        // Build message content: document blocks first, then text
        const userContent: Anthropic.Messages.ContentBlockParam[] = [
          ...documentBlocks,
          { type: 'text', text: userText },
        ]

        let aiData: Record<string, unknown> | null = null

        try {
          // Use streaming to track AI progress
          const aiStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
          })

          let lastStopReported = -1
          let textSoFar = ''

          aiStream.on('text', (chunk) => {
            textSoFar += chunk
            // Estimate progress based on how many stops we've seen in the output
            const stopMatches = textSoFar.match(/"index"\s*:\s*(\d+)/g)
            if (stopMatches) {
              const latestIndex = Math.max(...stopMatches.map(m => parseInt(m.match(/(\d+)/)![1])))
              if (latestIndex > lastStopReported) {
                lastStopReported = latestIndex
                const aiProgress = 30 + Math.round(((latestIndex + 1) / stops.length) * 60)
                const stopTitle = stops[latestIndex]?.title || `Stop ${latestIndex + 1}`
                sendEvent(controller, encoder, {
                  type: 'status',
                  message: `Writing stop ${latestIndex + 1}/${stops.length}: ${stopTitle}`,
                  progress: Math.min(aiProgress, 90),
                })
              }
            }
          })

          const response = await aiStream.finalMessage()

          const text = response.content
            .filter((c): c is Anthropic.TextBlock => c.type === 'text')
            .map(c => c.text).join('')

          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            aiData = JSON.parse(jsonMatch[0])
          }
        } catch (e) {
          console.error('AI processing error:', e)
          sendEvent(controller, encoder, { type: 'status', message: `AI warning: ${e instanceof Error ? e.message : 'processing error'} — using fallback`, progress: 90 })
        }

        // Step 5: Merge AI results (90-95%)
        sendEvent(controller, encoder, { type: 'status', message: 'Assembling tour data...', progress: 92 })

        let tour: Tour

        if (aiData) {
          for (const aiStop of (aiData.stops as Array<{ index: number; details?: string; kind?: string }>) || []) {
            const stop = stops[aiStop.index]
            if (!stop) continue
            stop.details = aiStop.details || stop.details
            if (aiStop.kind && POI_KINDS.includes(aiStop.kind as typeof POI_KINDS[number])) {
              stop.kind = aiStop.kind
            }
          }

          tour = {
            title: (aiData.title as string) || 'Untitled Tour',
            description: (aiData.description as string) || '',
            tourType: (aiData.tourType as string) || 'walk',
            categoryTag: (aiData.categoryTag as string) || '',
            challengeLevel: Math.min(Math.max((aiData.challengeLevel as number) || 2, 1), 3),
            durationRange: (aiData.durationMax as number) && (aiData.durationMax as number) !== (aiData.durationMin as number)
              ? [(aiData.durationMin as number), (aiData.durationMax as number)]
              : [(aiData.durationMin as number) || 60],
            distance,
            regionId: '',
            tourProviderId: '',
            stops,
            routePoints: trackPoints,
            gpxFileId,
          }
        } else {
          tour = {
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
        }

        // Step 6: Done (100%)
        const result: ProcessResult = { tour, files, unmatchedFiles: unmatched }
        sendEvent(controller, encoder, { type: 'done', message: 'Done!', progress: 100, result })
        controller.close()
      } catch (e) {
        sendEvent(controller, encoder, {
          type: 'error',
          message: e instanceof Error ? e.message : 'Processing failed',
          progress: 0,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
