# Tour Uploader v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a file-based tour uploader where creators drop GPX, images, videos, audio, and text files — AI organizes them into Sanity CMS tour drafts.

**Architecture:** Next.js App Router with three API routes (`/api/upload`, `/api/process`, `/api/publish`) and a single-page React UI with four states (drop → processing → review → publish). Files stage through DO Spaces; images compress via Sharp; Sanity documents are created atomically via transaction.

**Tech Stack:** Next.js 15, TypeScript, pnpm, Tailwind CSS, shadcn/ui, @aws-sdk/client-s3, @sanity/client, exifr, @anthropic-ai/sdk, sharp

**Spec:** `docs/superpowers/specs/2026-03-23-tour-uploader-design.md`

---

## File Structure

```
trovare-tour-creator/
├── app/
│   ├── layout.tsx                    — Root layout with Tailwind, metadata
│   ├── page.tsx                      — Main page: state machine orchestrating 4 screens
│   ├── globals.css                   — Tailwind directives + custom vars
│   ├── api/
│   │   ├── upload/route.ts           — File upload: compress images, presign large files, upload to DO Spaces
│   │   ├── process/route.ts          — AI processing: parse GPX, match media, generate descriptions
│   │   ├── publish/route.ts          — Sanity publish: assets + documents in transaction
│   │   └── presign/route.ts          — Generate presigned PUT URLs for large files
│   └── components/                   — App-specific UI components (not shadcn primitives)
│       ├── drop-zone.tsx             — Drag-and-drop file upload area
│       ├── processing-log.tsx        — Live AI processing status display
│       ├── review-panel.tsx          — Tour metadata + stop editor
│       ├── stop-card.tsx             — Individual stop: image, details, media, kind selector
│       ├── media-assignment.tsx      — Drag unmatched media onto stops
│       ├── publish-panel.tsx         — Publish button, testing mode output, duplicate warnings
│       └── dry-run-output.tsx        — Testing mode: syntax-highlighted JSON output
├── lib/
│   ├── types.ts                      — Shared TypeScript types (UploadedFile, Stop, Tour, etc.)
│   ├── constants.ts                  — POI kinds, tour types, category tags, regions, file limits
│   ├── spaces.ts                     — DO Spaces S3 client + upload/presign helpers
│   ├── sanity.ts                     — Sanity client + publish/query helpers
│   ├── gpx.ts                        — GPX parser: extract tracks, waypoints, calculate distance
│   ├── media-matcher.ts              — Match uploaded media to stops via EXIF GPS + filename
│   ├── map-image.ts                  — Generate static map PNG from route + stops via Sharp composite
│   └── duplicates.ts                 — Check Sanity for duplicate tours/POIs
├── components/ui/                    — shadcn/ui primitives (auto-generated)
├── .env.local                        — Local env vars (not committed)
├── .env.example                      — Template for required env vars
├── next.config.ts                    — Next.js config (Sharp external package for serverless)
├── tailwind.config.ts                — Tailwind config
├── tsconfig.json                     — TypeScript config
├── package.json                      — pnpm dependencies
└── postcss.config.mjs                — PostCSS for Tailwind
```

---

## Task 1: Scaffold Next.js project with pnpm

**Files:**
- Delete: `src/`, `api/`, `index.html`, `vite.config.js`, `package-lock.json`, `vercel.json`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `package.json`, `.env.example`, `.env.local`

- [ ] **Step 1: Remove old Vite project files**

```bash
rm -rf src api index.html vite.config.js package-lock.json node_modules
```

- [ ] **Step 2: Initialize Next.js with pnpm**

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm
```

Accept overwriting `package.json` and `vercel.json`. This creates the base Next.js scaffold.

- [ ] **Step 3: Install dependencies**

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @sanity/client exifr @anthropic-ai/sdk sharp
pnpm add -D @types/node
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables enabled.

- [ ] **Step 5: Install shadcn components**

```bash
pnpm dlx shadcn@latest add button card select input textarea progress dialog badge toast tabs dropdown-menu
```

- [ ] **Step 6: Create .env.example**

Create `.env.example`:
```
ANTHROPIC_API_KEY=
SANITY_API_TOKEN=
SANITY_PROJECT_ID=48sx65rc
SANITY_DATASET=production
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=go-trovare
DO_SPACES_CDN=https://go-trovare.nyc3.digitaloceanspaces.com
TESTING_MODE=false
```

- [ ] **Step 7: Create .env.local with actual values**

Copy `.env.example` to `.env.local` and fill in the real credentials. Add `.env.local` to `.gitignore` (Next.js does this by default).

- [ ] **Step 8: Update next.config.ts for Sharp on serverless**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
}

export default nextConfig
```

- [ ] **Step 9: Create minimal app/page.tsx placeholder**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <h1 className="text-2xl font-bold">Trovare Tour Uploader</h1>
    </main>
  )
}
```

- [ ] **Step 10: Verify dev server runs**

```bash
pnpm dev
```

Open http://localhost:3000 — should see "Trovare Tour Uploader".

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with pnpm, Tailwind, shadcn/ui"
```

---

## Task 2: Shared types and constants

**Files:**
- Create: `lib/types.ts`, `lib/constants.ts`

- [ ] **Step 1: Create lib/types.ts**

```typescript
export type FileCategory = 'gpx' | 'image' | 'audio' | 'video' | 'text'

export interface UploadedFile {
  id: string
  originalName: string
  category: FileCategory
  url: string             // DO Spaces CDN URL
  size: number            // bytes
  mimeType: string
  exifGps?: { lat: number; lng: number }  // extracted from images
}

export interface Stop {
  id: string
  title: string
  kind: string            // one of POI_KINDS
  details: string         // markdown
  lat: number
  lng: number
  imageId?: string        // matched UploadedFile.id
  audioId?: string        // matched UploadedFile.id
  videoId?: string        // matched UploadedFile.id
  duplicateWarning?: DuplicateWarning
}

export interface Tour {
  title: string
  description: string     // markdown
  tourType: string        // walk|bike|drive|run
  categoryTag: string
  challengeLevel: number  // 1-3
  durationRange: number[] // [min] or [min, max] in minutes
  distance: number        // miles
  regionId: string
  tourProviderId: string
  stops: Stop[]
  routePoints: { lat: number; lng: number; ts?: number }[]
  gpxFileId?: string      // UploadedFile.id for the GPX
  duplicateWarning?: DuplicateWarning
}

export interface DuplicateWarning {
  type: 'title' | 'location'
  existingId: string
  existingTitle: string
  message: string
}

export interface ProcessResult {
  tour: Tour
  files: UploadedFile[]
  unmatchedFiles: UploadedFile[]
}

export interface DryRunDocument {
  _id: string
  _type: string
  [key: string]: unknown
}

export interface DryRunOutput {
  documents: DryRunDocument[]
  assets: { filename: string; type: string; size: number; destination: string }[]
  references: { from: string; to: string; field: string }[]
  warnings: string[]
}

export interface PublishResult {
  success: boolean
  studioUrl?: string
  dryRun?: DryRunOutput
  error?: string
}
```

- [ ] **Step 2: Create lib/constants.ts**

```typescript
export const POI_KINDS = [
  'airport', 'bankAtm', 'barPub', 'beach', 'cafeRestaurant', 'gasStation',
  'hospital', 'hotel', 'museum', 'park', 'parking', 'pharmacy',
  'publicTransport', 'shopSupermarket', 'toilet', 'touristAttraction',
] as const

export const TOUR_TYPES = ['walk', 'bike', 'drive', 'run'] as const
export const CATEGORY_TAGS = ['food', 'culture', 'nature', 'history', 'adventure', 'scenic'] as const

export const REGIONS = [
  { _id: 'f62ad0f8-efa5-4870-be0e-e0647ad25cfb', title: 'Cannon Beach' },
  { _id: '585c28d9-6212-4a9e-b124-f9c8102dff3a', title: 'Casablanca' },
  { _id: 'c5bd0b4c-a671-4939-af44-7d8cee79b739', title: 'Colombian Highlands' },
  { _id: 'd68d9de9-563c-415d-86fb-fcb621e12c58', title: 'Copenhagen' },
  { _id: '46c56d61-4174-42b8-803d-f34361858510', title: 'Edinburgh' },
  { _id: '8ab3a446-3359-42fe-ad20-414264314151', title: 'Gran Canaria' },
  { _id: 'f98b5496-91b4-4271-8d24-e5e528d83cdc', title: 'Kyoto' },
  { _id: 'a51a17e1-b7ad-43e1-a493-3cb12c4c643b', title: 'Marrakesh' },
] as const

export const FILE_LIMITS = {
  image: 20 * 1024 * 1024,    // 20MB
  audio: 50 * 1024 * 1024,    // 50MB
  video: 200 * 1024 * 1024,   // 200MB
  gpx: 5 * 1024 * 1024,       // 5MB
  text: 1 * 1024 * 1024,      // 1MB
} as const

export const ACCEPTED_TYPES: Record<string, string[]> = {
  gpx: ['.gpx'],
  image: ['.jpg', '.jpeg', '.png'],
  audio: ['.mp3'],
  video: ['.mp4'],
  text: ['.txt', '.md'],
}

export const SANITY_PROJECT = '48sx65rc'
export const SANITY_DATASET = 'production'
export const SANITY_API_VERSION = '2022-03-07'
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "Add shared types and constants"
```

---

## Task 3: DO Spaces client (lib/spaces.ts)

**Files:**
- Create: `lib/spaces.ts`

- [ ] **Step 1: Create lib/spaces.ts**

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: 'nyc3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
})

const bucket = process.env.DO_SPACES_BUCKET!
const cdnBase = process.env.DO_SPACES_CDN!

export async function uploadToSpaces(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  }))
  return `${cdnBase}/${key}`
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  })
  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

export async function deleteFromSpaces(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export function cdnUrl(key: string): string {
  return `${cdnBase}/${key}`
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/spaces.ts
git commit -m "Add DO Spaces S3 client with upload, presign, delete helpers"
```

---

## Task 4: Sanity client (lib/sanity.ts)

**Files:**
- Create: `lib/sanity.ts`

- [ ] **Step 1: Create lib/sanity.ts**

```typescript
import { createClient } from '@sanity/client'

export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '48sx65rc',
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2022-03-07',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

export async function uploadSanityAsset(
  blob: Buffer,
  type: 'image' | 'file',
  filename: string,
  contentType: string
): Promise<string> {
  const asset = type === 'image'
    ? await sanity.assets.upload('image', blob, { filename, contentType })
    : await sanity.assets.upload('file', blob, { filename, contentType })
  return asset._id
}

export async function fetchTourProviders(): Promise<{ _id: string; title: string }[]> {
  return sanity.fetch('*[_type == "tourProvider"]{_id, title} | order(title asc)')
}

export async function fetchRegions(): Promise<{ _id: string; title: string }[]> {
  return sanity.fetch('*[_type == "region"]{_id, title} | order(title asc)')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sanity.ts
git commit -m "Add Sanity client with asset upload and query helpers"
```

---

## Task 5: GPX parser (lib/gpx.ts)

**Files:**
- Create: `lib/gpx.ts`

- [ ] **Step 1: Create lib/gpx.ts**

```typescript
interface TrackPoint {
  lat: number
  lng: number
  ts?: number
}

interface Waypoint {
  name: string
  lat: number
  lng: number
}

export interface GPXData {
  trackPoints: TrackPoint[]
  waypoints: Waypoint[]
  distance: number // miles
}

export function parseGPX(xml: string): GPXData {
  const trackPoints: TrackPoint[] = []
  const waypoints: Waypoint[] = []

  // Parse track points
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi
  let match
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    const timeMatch = match[3].match(/<time>([^<]+)<\/time>/)
    trackPoints.push({
      lat, lng,
      ts: timeMatch ? new Date(timeMatch[1]).getTime() : undefined,
    })
  }

  // Parse waypoints
  const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/gi
  while ((match = wptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    const nameMatch = match[3].match(/<name>([^<]+)<\/name>/)
    waypoints.push({
      name: nameMatch ? nameMatch[1].trim() : `Waypoint ${waypoints.length + 1}`,
      lat, lng,
    })
  }

  // Calculate distance in miles (Haversine)
  let distance = 0
  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1]
    const curr = trackPoints[i]
    const R = 3958.8 // Earth radius in miles
    const dLat = (curr.lat - prev.lat) * Math.PI / 180
    const dLng = (curr.lng - prev.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  return { trackPoints, waypoints, distance: Math.round(distance * 10) / 10 }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gpx.ts
git commit -m "Add GPX parser with track points, waypoints, and Haversine distance"
```

---

## Task 6: Media matcher (lib/media-matcher.ts)

**Files:**
- Create: `lib/media-matcher.ts`

- [ ] **Step 1: Create lib/media-matcher.ts**

```typescript
import type { UploadedFile, Stop } from './types'

const DISTANCE_THRESHOLD_M = 100 // meters

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_\s]+/g, ' ').trim()
}

export function matchMediaToStops(
  files: UploadedFile[],
  stops: Stop[]
): { matched: Map<string, string[]>; unmatched: UploadedFile[] } {
  const matched = new Map<string, string[]>() // stopId -> fileIds
  const unmatched: UploadedFile[] = []
  const usedFileIds = new Set<string>()

  // Pass 1: Match images by EXIF GPS
  for (const file of files) {
    if (file.category !== 'image' || !file.exifGps) continue
    let bestStop: Stop | null = null
    let bestDist = Infinity
    for (const stop of stops) {
      const dist = haversineMeters(file.exifGps.lat, file.exifGps.lng, stop.lat, stop.lng)
      if (dist < DISTANCE_THRESHOLD_M && dist < bestDist) {
        bestDist = dist
        bestStop = stop
      }
    }
    if (bestStop) {
      const existing = matched.get(bestStop.id) || []
      existing.push(file.id)
      matched.set(bestStop.id, existing)
      usedFileIds.add(file.id)
    }
  }

  // Pass 2: Match remaining files by filename similarity to stop titles
  for (const file of files) {
    if (usedFileIds.has(file.id)) continue
    const normalized = normalizeFilename(file.originalName)
    for (const stop of stops) {
      const stopName = stop.title.toLowerCase().trim()
      if (stopName && (normalized.includes(stopName) || stopName.includes(normalized))) {
        const existing = matched.get(stop.id) || []
        existing.push(file.id)
        matched.set(stop.id, existing)
        usedFileIds.add(file.id)
        break
      }
    }
  }

  // Collect unmatched
  for (const file of files) {
    if (!usedFileIds.has(file.id) && file.category !== 'gpx' && file.category !== 'text') {
      unmatched.push(file)
    }
  }

  return { matched, unmatched }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/media-matcher.ts
git commit -m "Add media matcher: EXIF GPS proximity + filename matching"
```

---

## Task 7: Duplicate detection (lib/duplicates.ts)

**Files:**
- Create: `lib/duplicates.ts`

- [ ] **Step 1: Create lib/duplicates.ts**

```typescript
import { sanity } from './sanity'
import type { DuplicateWarning, Stop, Tour } from './types'

export async function checkTourDuplicates(title: string): Promise<DuplicateWarning | undefined> {
  const results = await sanity.fetch(
    '*[_type == "tour" && title == $title]{_id, title}',
    { title }
  )
  if (results.length > 0) {
    return {
      type: 'title',
      existingId: results[0]._id,
      existingTitle: results[0].title,
      message: `A tour named "${title}" already exists`,
    }
  }
}

export async function checkPOIDuplicates(stops: Stop[]): Promise<Map<string, DuplicateWarning>> {
  const warnings = new Map<string, DuplicateWarning>()

  for (const stop of stops) {
    // Check by title
    const titleResults = await sanity.fetch(
      '*[_type == "pointOfInterest" && title == $title]{_id, title}',
      { title: stop.title }
    )
    if (titleResults.length > 0) {
      warnings.set(stop.id, {
        type: 'title',
        existingId: titleResults[0]._id,
        existingTitle: titleResults[0].title,
        message: `A POI named "${stop.title}" already exists`,
      })
      continue
    }

    // Check by location proximity (50m)
    // Note: Sanity GROQ geo::distance requires a geospatial index.
    // Fallback: fetch nearby POIs and compute distance client-side.
    const nearbyResults = await sanity.fetch(
      '*[_type == "pointOfInterest" && defined(location)]{_id, title, "lat": location.lat, "lng": location.lng}'
    )
    for (const poi of nearbyResults) {
      const R = 6371000
      const dLat = (poi.lat - stop.lat) * Math.PI / 180
      const dLng = (poi.lng - stop.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(stop.lat * Math.PI / 180) * Math.cos(poi.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      if (dist < 50) {
        warnings.set(stop.id, {
          type: 'location',
          existingId: poi._id,
          existingTitle: poi.title,
          message: `A POI "${poi.title}" exists within 50m of this stop`,
        })
        break
      }
    }
  }

  return warnings
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/duplicates.ts
git commit -m "Add duplicate detection for tours and POIs"
```

---

## Task 8: Map image generator (lib/map-image.ts)

**Files:**
- Create: `lib/map-image.ts`

- [ ] **Step 1: Create lib/map-image.ts**

This generates a static map PNG server-side using Sharp to composite CARTO tiles with a route overlay.

```typescript
import sharp from 'sharp'

interface Point { lat: number; lng: number }

function latLngToPixel(lat: number, lng: number, zoom: number, centerLat: number, centerLng: number, w: number, h: number) {
  const scale = Math.pow(2, zoom) * 256
  const worldX = (lng + 180) / 360 * scale
  const worldY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale
  const centerX = (centerLng + 180) / 360 * scale
  const centerY = (1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * scale
  return { x: Math.round(worldX - centerX + w / 2), y: Math.round(worldY - centerY + h / 2) }
}

export async function generateMapImage(
  routePoints: Point[],
  stops: { lat: number; lng: number; index: number }[],
  width = 600,
  height = 400
): Promise<Buffer> {
  if (!routePoints.length) {
    // Blank dark image as fallback
    return sharp({ create: { width, height, channels: 4, background: { r: 26, g: 26, b: 46, alpha: 1 } } })
      .png().toBuffer()
  }

  const lats = routePoints.map(p => p.lat)
  const lngs = routePoints.map(p => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const maxSpan = Math.max(maxLat - minLat, maxLng - minLng)
  const zoom = maxSpan > 1 ? 10 : maxSpan > 0.5 ? 11 : maxSpan > 0.1 ? 13 : maxSpan > 0.01 ? 15 : 16

  // Fetch CARTO tiles and composite
  const tileSize = 256
  const scale = Math.pow(2, zoom)
  const centerWorldX = (centerLng + 180) / 360 * scale * tileSize
  const centerWorldY = (1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * scale * tileSize
  const startTileX = Math.floor((centerWorldX - width / 2) / tileSize)
  const startTileY = Math.floor((centerWorldY - height / 2) / tileSize)
  const endTileX = Math.floor((centerWorldX + width / 2) / tileSize)
  const endTileY = Math.floor((centerWorldY + height / 2) / tileSize)
  const offsetX = Math.round(centerWorldX - width / 2 - startTileX * tileSize)
  const offsetY = Math.round(centerWorldY - height / 2 - startTileY * tileSize)

  const composites: sharp.OverlayOptions[] = []

  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      const sub = ['a', 'b', 'c', 'd'][Math.abs(tx + ty) % 4]
      const url = `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`
      try {
        const res = await fetch(url)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          composites.push({
            input: buf,
            left: (tx - startTileX) * tileSize - offsetX,
            top: (ty - startTileY) * tileSize - offsetY,
          })
        }
      } catch { /* skip failed tiles */ }
    }
  }

  // Create SVG overlay for route line + stop pins
  const routePathPoints = routePoints.map(p => {
    const px = latLngToPixel(p.lat, p.lng, zoom, centerLat, centerLng, width, height)
    return `${px.x},${px.y}`
  }).join(' ')

  const stopCircles = stops.map(s => {
    const px = latLngToPixel(s.lat, s.lng, zoom, centerLat, centerLng, width, height)
    return `<circle cx="${px.x}" cy="${px.y}" r="8" fill="#1D9E75"/>
      <text x="${px.x}" y="${px.y + 4}" text-anchor="middle" font-size="10" font-weight="bold" fill="white">${s.index + 1}</text>`
  }).join('\n')

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${routePathPoints}" fill="none" stroke="#1D9E75" stroke-width="3"/>
    ${stopCircles}
  </svg>`

  composites.push({ input: Buffer.from(svg), left: 0, top: 0 })

  return sharp({ create: { width, height, channels: 4, background: { r: 26, g: 26, b: 46, alpha: 1 } } })
    .composite(composites)
    .png()
    .toBuffer()
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/map-image.ts
git commit -m "Add server-side map image generator using Sharp + CARTO tiles"
```

---

## Task 9: API route — /api/upload

**Files:**
- Create: `app/api/upload/route.ts`, `app/api/presign/route.ts`

- [ ] **Step 1: Create app/api/presign/route.ts**

```typescript
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
```

- [ ] **Step 2: Create app/api/upload/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import exifr from 'exifr'
import { uploadToSpaces, cdnUrl } from '@/lib/spaces'
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

  const buffer = Buffer.from(await file.arrayBuffer())
  const id = crypto.randomUUID()

  let exifGps: { lat: number; lng: number } | undefined
  let uploadBuffer = buffer
  let contentType = file.type
  let finalFilename = file.name

  if (category === 'image') {
    // Extract EXIF GPS before compression
    try {
      const gps = await exifr.gps(buffer)
      if (gps?.latitude && gps?.longitude) {
        exifGps = { lat: gps.latitude, lng: gps.longitude }
      }
    } catch { /* no EXIF */ }

    // Compress image
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

export const config = {
  api: { bodyParser: false },
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/ app/api/presign/
git commit -m "Add upload + presign API routes with Sharp image compression"
```

---

## Task 10: API route — /api/process

**Files:**
- Create: `app/api/process/route.ts`

- [ ] **Step 1: Create app/api/process/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseGPX } from '@/lib/gpx'
import { matchMediaToStops } from '@/lib/media-matcher'
import { POI_KINDS } from '@/lib/constants'
import type { UploadedFile, Stop, Tour, ProcessResult } from '@/lib/types'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: UploadedFile[] }

  // 1. Find and parse GPX
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

  // 2. Build initial stops from waypoints
  const stops: Stop[] = waypoints.map((wp, i) => ({
    id: crypto.randomUUID(),
    title: wp.name,
    kind: 'touristAttraction',
    details: '',
    lat: wp.lat,
    lng: wp.lng,
  }))

  // 3. Match media to stops
  const mediaFiles = files.filter(f => f.category !== 'gpx' && f.category !== 'text')
  const { matched, unmatched } = matchMediaToStops(mediaFiles, stops)

  // Assign matched files to stops
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

  // 4. Gather text context
  const textFiles = files.filter(f => f.category === 'text')
  let textContext = ''
  for (const tf of textFiles) {
    const res = await fetch(tf.url)
    textContext += await res.text() + '\n'
  }

  // 5. AI: generate stop descriptions + tour metadata
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
    { "index": 0, "details": "...markdown...", "kind": "touristAttraction" },
    ...
  ]
}`

  const userMessage = `Here are the stops:\n${stopContext}\n\nDistance: ${distance} miles.\n${textContext ? `\nCreator notes:\n${textContext}` : ''}\n\nSearch the web for real information about each stop before writing.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    })

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map(c => c.text).join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const aiData = JSON.parse(jsonMatch[0])

      // Merge AI data into stops
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

  // Fallback if AI fails
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/process/
git commit -m "Add process API route: GPX parsing, media matching, AI descriptions"
```

---

## Task 11: API route — /api/publish

**Files:**
- Create: `app/api/publish/route.ts`

- [ ] **Step 1: Create app/api/publish/route.ts**

```typescript
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

  // Check duplicates
  const tourDupe = await checkTourDuplicates(tour.title)
  const poiDupes = await checkPOIDuplicates(tour.stops)

  // Build POI documents
  const poiDocs: DryRunDocument[] = []
  const assets: DryRunOutput['assets'] = []
  const references: DryRunOutput['references'] = []
  const warnings: string[] = []

  if (tourDupe) warnings.push(tourDupe.message)
  for (const [stopId, warning] of poiDupes) {
    warnings.push(warning.message)
  }

  for (const stop of tour.stops) {
    const poiId = 'drafts.' + genId()

    // POI preview image
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

    // Audio/video as r2.asset objects pointing to DO Spaces
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

  // GPX route file
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

  // Map image
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

  // Tour document
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

  // Dry run mode
  if (testingMode) {
    const dryRunOutput: DryRunOutput = {
      documents: [...poiDocs, tourDoc],
      assets,
      references,
      warnings,
    }
    return NextResponse.json({ success: true, dryRun: dryRunOutput } as PublishResult)
  }

  // Real publish — atomic transaction
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/publish/
git commit -m "Add publish API route: Sanity transaction, dry-run mode, duplicate detection"
```

---

## Task 12: Drop zone component

**Files:**
- Create: `app/components/drop-zone.tsx`

- [ ] **Step 1: Create app/components/drop-zone.tsx**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ACCEPTED_TYPES, FILE_LIMITS } from '@/lib/constants'
import type { UploadedFile, FileCategory } from '@/lib/types'

const ALL_EXTENSIONS = Object.values(ACCEPTED_TYPES).flat()
const ACCEPT_STRING = ALL_EXTENSIONS.join(',')

function categorize(filename: string): FileCategory | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  for (const [cat, exts] of Object.entries(ACCEPTED_TYPES)) {
    if (exts.includes(ext)) return cat as FileCategory
  }
  return null
}

interface DropZoneProps {
  onFilesUploaded: (files: UploadedFile[]) => void
  uploading: boolean
  setUploading: (v: boolean) => void
}

export function DropZone({ onFilesUploaded, uploading, setUploading }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    setErrors([])
    const total = fileList.length
    const results: UploadedFile[] = []
    const errs: string[] = []

    for (let i = 0; i < total; i++) {
      const file = fileList[i]
      const category = categorize(file.name)
      if (!category) { errs.push(`Skipped ${file.name}: unsupported type`); continue }

      const limit = FILE_LIMITS[category]
      if (file.size > limit) {
        // Use presigned URL for large files (audio/video)
        if (category === 'audio' || category === 'video') {
          try {
            const presignRes = await fetch('/api/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, category }),
            })
            if (!presignRes.ok) {
              const err = await presignRes.json()
              errs.push(`${file.name}: ${err.error}`)
              continue
            }
            const { presignedUrl, key, uploadId } = await presignRes.json()
            await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
            results.push({
              id: uploadId,
              originalName: file.name,
              category,
              url: `${process.env.NEXT_PUBLIC_DO_SPACES_CDN}/${key}`,
              size: file.size,
              mimeType: file.type,
            })
          } catch (e: any) {
            errs.push(`${file.name}: upload failed`)
          }
        } else {
          errs.push(`${file.name}: too large (max ${Math.round(limit / 1024 / 1024)}MB)`)
        }
        setProgress(((i + 1) / total) * 100)
        continue
      }

      // Normal upload via API route
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          errs.push(`${file.name}: ${err.error}`)
        } else {
          results.push(await res.json())
        }
      } catch {
        errs.push(`${file.name}: upload failed`)
      }
      setProgress(((i + 1) / total) * 100)
    }

    setUploadedFiles(prev => [...prev, ...results])
    setErrors(errs)
    setUploading(false)
    if (results.length > 0) onFilesUploaded(results)
  }, [onFilesUploaded, setUploading])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }, [uploadFiles])

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'; input.multiple = true; input.accept = ACCEPT_STRING
          input.onchange = () => { if (input.files?.length) uploadFiles(input.files) }
          input.click()
        }}
      >
        <div className="space-y-2">
          <p className="text-lg font-medium">{uploading ? 'Uploading...' : 'Drop your tour files here'}</p>
          <p className="text-sm text-muted-foreground">
            GPX routes, images, videos, audio, text descriptions
          </p>
          <p className="text-xs text-muted-foreground">
            .gpx .jpg .png .mp4 .mp3 .txt .md
          </p>
        </div>
      </Card>

      {uploading && <Progress value={progress} />}

      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">{err}</p>
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map(f => (
            <Badge key={f.id} variant="secondary">
              {f.category === 'gpx' ? '🗺️' : f.category === 'image' ? '🖼️' : f.category === 'audio' ? '🎵' : f.category === 'video' ? '🎬' : '📄'}
              {' '}{f.originalName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add NEXT_PUBLIC_DO_SPACES_CDN to .env.local and .env.example**

Add to both files:
```
NEXT_PUBLIC_DO_SPACES_CDN=https://go-trovare.nyc3.digitaloceanspaces.com
```

- [ ] **Step 3: Commit**

```bash
git add app/components/drop-zone.tsx .env.example
git commit -m "Add drop zone component with drag-and-drop + presigned URL upload"
```

---

## Task 13: Processing log component

**Files:**
- Create: `app/components/processing-log.tsx`

- [ ] **Step 1: Create app/components/processing-log.tsx**

```tsx
'use client'

import { Card } from '@/components/ui/card'

interface ProcessingLogProps {
  messages: string[]
  processing: boolean
}

export function ProcessingLog({ messages, processing }: ProcessingLogProps) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        {processing && <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
        <h2 className="text-lg font-semibold">{processing ? 'Building your tour...' : 'Processing complete'}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Parsing GPX, matching media, researching stops, writing descriptions...
      </p>
      <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto font-mono text-sm space-y-1">
        {messages.map((msg, i) => (
          <div key={i} className="text-muted-foreground">{msg}</div>
        ))}
        {processing && <div className="animate-pulse text-muted-foreground">...</div>}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/processing-log.tsx
git commit -m "Add processing log component"
```

---

## Task 14: Review panel + stop card components

**Files:**
- Create: `app/components/review-panel.tsx`, `app/components/stop-card.tsx`, `app/components/media-assignment.tsx`

- [ ] **Step 1: Create app/components/stop-card.tsx**

```tsx
'use client'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { POI_KINDS } from '@/lib/constants'
import type { Stop, UploadedFile } from '@/lib/types'

interface StopCardProps {
  stop: Stop
  index: number
  files: UploadedFile[]
  onUpdate: (stop: Stop) => void
}

export function StopCard({ stop, index, files, onUpdate }: StopCardProps) {
  const imageFile = stop.imageId ? files.find(f => f.id === stop.imageId) : null
  const audioFile = stop.audioId ? files.find(f => f.id === stop.audioId) : null
  const videoFile = stop.videoId ? files.find(f => f.id === stop.videoId) : null

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
          {index + 1}
        </div>
        <Input
          value={stop.title}
          onChange={e => onUpdate({ ...stop, title: e.target.value })}
          placeholder="Stop name..."
          className="font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={stop.kind} onValueChange={kind => onUpdate({ ...stop, kind })}>
          <SelectTrigger><SelectValue placeholder="Kind" /></SelectTrigger>
          <SelectContent>
            {POI_KINDS.map(k => (
              <SelectItem key={k} value={k}>{k.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground flex items-center">
          📍 {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
        </div>
      </div>

      <Textarea
        value={stop.details}
        onChange={e => onUpdate({ ...stop, details: e.target.value })}
        placeholder="Description (markdown)..."
        rows={4}
      />

      <div className="flex flex-wrap gap-2">
        {imageFile && <Badge variant="secondary">🖼️ {imageFile.originalName}</Badge>}
        {audioFile && <Badge variant="secondary">🎵 {audioFile.originalName}</Badge>}
        {videoFile && <Badge variant="secondary">🎬 {videoFile.originalName}</Badge>}
        {!imageFile && <Badge variant="destructive">⚠️ No image</Badge>}
      </div>

      {stop.duplicateWarning && (
        <div className="text-sm text-yellow-500 bg-yellow-500/10 rounded p-2">
          ⚠️ {stop.duplicateWarning.message}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Create app/components/media-assignment.tsx**

```tsx
'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UploadedFile, Stop } from '@/lib/types'

interface MediaAssignmentProps {
  unmatchedFiles: UploadedFile[]
  stops: Stop[]
  onAssign: (fileId: string, stopId: string) => void
}

export function MediaAssignment({ unmatchedFiles, stops, onAssign }: MediaAssignmentProps) {
  if (!unmatchedFiles.length) return null

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-medium">Unmatched media — assign to stops</h3>
      <div className="space-y-2">
        {unmatchedFiles.map(file => (
          <div key={file.id} className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {file.category === 'image' ? '🖼️' : file.category === 'audio' ? '🎵' : '🎬'}
              {' '}{file.originalName}
            </Badge>
            <span className="text-xs text-muted-foreground">→</span>
            {stops.map((stop, i) => (
              <Button
                key={stop.id}
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onAssign(file.id, stop.id)}
              >
                Stop {i + 1}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Create app/components/review-panel.tsx**

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { StopCard } from './stop-card'
import { MediaAssignment } from './media-assignment'
import { TOUR_TYPES, CATEGORY_TAGS, REGIONS } from '@/lib/constants'
import type { Tour, UploadedFile } from '@/lib/types'

interface ReviewPanelProps {
  tour: Tour
  files: UploadedFile[]
  unmatchedFiles: UploadedFile[]
  tourProviders: { _id: string; title: string }[]
  onTourUpdate: (tour: Tour) => void
  onAssignMedia: (fileId: string, stopId: string) => void
}

export function ReviewPanel({ tour, files, unmatchedFiles, tourProviders, onTourUpdate, onAssignMedia }: ReviewPanelProps) {
  const updateStop = (updated: Tour['stops'][0]) => {
    onTourUpdate({
      ...tour,
      stops: tour.stops.map(s => s.id === updated.id ? updated : s),
    })
  }

  return (
    <div className="space-y-6">
      {/* Tour metadata */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">Tour details</h2>
        <Input
          value={tour.title}
          onChange={e => onTourUpdate({ ...tour, title: e.target.value })}
          placeholder="Tour title..."
          className="text-lg font-medium"
        />
        <Textarea
          value={tour.description}
          onChange={e => onTourUpdate({ ...tour, description: e.target.value })}
          placeholder="Tour description (markdown)..."
          rows={3}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select value={tour.tourType} onValueChange={tourType => onTourUpdate({ ...tour, tourType })}>
            <SelectTrigger><SelectValue placeholder="Movement type" /></SelectTrigger>
            <SelectContent>
              {TOUR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tour.categoryTag} onValueChange={categoryTag => onTourUpdate({ ...tour, categoryTag })}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {CATEGORY_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select value={String(tour.challengeLevel)} onValueChange={v => onTourUpdate({ ...tour, challengeLevel: parseInt(v) })}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — Easy</SelectItem>
              <SelectItem value="2">2 — Moderate</SelectItem>
              <SelectItem value="3">3 — Hard</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={tour.durationRange[0] || ''}
            onChange={e => onTourUpdate({ ...tour, durationRange: [parseInt(e.target.value) || 0, tour.durationRange[1] || 0] })}
            placeholder="Min (mins)"
          />
          <Input
            type="number"
            value={tour.durationRange[1] || ''}
            onChange={e => onTourUpdate({ ...tour, durationRange: [tour.durationRange[0] || 0, parseInt(e.target.value) || 0] })}
            placeholder="Max (mins)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={tour.regionId} onValueChange={regionId => onTourUpdate({ ...tour, regionId })}>
            <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">No region</SelectItem>
              {REGIONS.map(r => <SelectItem key={r._id} value={r._id}>{r.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tour.tourProviderId} onValueChange={tourProviderId => onTourUpdate({ ...tour, tourProviderId })}>
            <SelectTrigger><SelectValue placeholder="Tour provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {tourProviders.map(tp => <SelectItem key={tp._id} value={tp._id}>{tp.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          📏 {tour.distance} miles · {tour.stops.length} stops
        </div>
      </Card>

      {/* Unmatched media */}
      <MediaAssignment
        unmatchedFiles={unmatchedFiles}
        stops={tour.stops}
        onAssign={onAssignMedia}
      />

      {/* Stop cards */}
      {tour.stops.map((stop, i) => (
        <StopCard
          key={stop.id}
          stop={stop}
          index={i}
          files={files}
          onUpdate={updateStop}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/components/review-panel.tsx app/components/stop-card.tsx app/components/media-assignment.tsx
git commit -m "Add review panel, stop card, and media assignment components"
```

---

## Task 15: Publish panel + dry-run output components

**Files:**
- Create: `app/components/publish-panel.tsx`, `app/components/dry-run-output.tsx`

- [ ] **Step 1: Create app/components/dry-run-output.tsx**

```tsx
'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DryRunOutput } from '@/lib/types'

interface DryRunOutputProps {
  data: DryRunOutput
}

export function DryRunOutputPanel({ data }: DryRunOutputProps) {
  const fullJson = JSON.stringify(data, null, 2)

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-yellow-500">🧪 Testing Mode — Dry Run</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(fullJson)}
        >
          Copy JSON
        </Button>
      </div>

      {data.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-yellow-500">Warnings</h4>
          {data.warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-500/80">⚠️ {w}</p>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium mb-1">Documents ({data.documents.length})</h4>
        {data.documents.map((doc, i) => (
          <details key={i} className="mb-2">
            <summary className="text-sm cursor-pointer hover:text-foreground text-muted-foreground">
              {doc._type}: {(doc.title as string) || doc._id}
            </summary>
            <pre className="text-xs bg-muted rounded p-3 mt-1 overflow-x-auto max-h-60">
              {JSON.stringify(doc, null, 2)}
            </pre>
          </details>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-1">Assets ({data.assets.length})</h4>
        {data.assets.map((a, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {a.type} → {a.destination}: {a.filename} ({Math.round(a.size / 1024)}KB)
          </p>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-1">References ({data.references.length})</h4>
        {data.references.map((r, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {r.from} → {r.to} ({r.field})
          </p>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Create app/components/publish-panel.tsx**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DryRunOutputPanel } from './dry-run-output'
import type { PublishResult, Tour } from '@/lib/types'

interface PublishPanelProps {
  tour: Tour
  publishResult: PublishResult | null
  publishing: boolean
  onPublish: (dryRun: boolean) => void
  onReset: () => void
}

export function PublishPanel({ tour, publishResult, publishing, onPublish, onReset }: PublishPanelProps) {
  const missingImages = tour.stops.filter(s => !s.imageId)
  const canPublish = missingImages.length === 0 && tour.title && tour.stops.length > 0

  if (publishResult?.success && !publishResult.dryRun) {
    return (
      <Card className="p-6 text-center space-y-4">
        <h2 className="text-xl font-semibold">Published!</h2>
        <p className="text-muted-foreground">Your tour is in Sanity as a draft. Open Studio to review and go live.</p>
        {publishResult.studioUrl && (
          <a
            href={publishResult.studioUrl}
            target="_blank"
            rel="noopener"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold"
          >
            Open Sanity Studio →
          </a>
        )}
        <Button variant="outline" onClick={onReset}>Start another tour</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {publishResult?.dryRun && <DryRunOutputPanel data={publishResult.dryRun} />}

      {publishResult?.error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm text-destructive">{publishResult.error}</p>
        </Card>
      )}

      {missingImages.length > 0 && (
        <Card className="p-4 border-yellow-500/50">
          <p className="text-sm text-yellow-500">
            ⚠️ {missingImages.length} stop(s) missing a preview image: {missingImages.map(s => `"${s.title}"`).join(', ')}
          </p>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onPublish(true)}
          disabled={publishing}
        >
          {publishing ? 'Running...' : '🧪 Dry run'}
        </Button>
        <Button
          onClick={() => onPublish(false)}
          disabled={!canPublish || publishing}
        >
          {publishing ? 'Publishing...' : 'Publish to Sanity'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/publish-panel.tsx app/components/dry-run-output.tsx
git commit -m "Add publish panel with dry-run output and duplicate warnings"
```

---

## Task 16: Main page — state machine orchestrating all screens

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write app/page.tsx**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DropZone } from './components/drop-zone'
import { ProcessingLog } from './components/processing-log'
import { ReviewPanel } from './components/review-panel'
import { PublishPanel } from './components/publish-panel'
import type { UploadedFile, Tour, ProcessResult, PublishResult } from '@/lib/types'

type Screen = 'drop' | 'processing' | 'review' | 'publish'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('drop')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UploadedFile[]>([])
  const [tour, setTour] = useState<Tour | null>(null)
  const [tourProviders, setTourProviders] = useState<{ _id: string; title: string }[]>([])
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  const handleFilesUploaded = useCallback((newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleProcess = useCallback(async () => {
    if (!files.length) return
    setScreen('processing')
    setProcessing(true)
    setLogMessages(['Starting processing...'])

    const gpxCount = files.filter(f => f.category === 'gpx').length
    const imageCount = files.filter(f => f.category === 'image').length
    setLogMessages(m => [...m, `Found ${gpxCount} GPX file(s), ${imageCount} image(s), ${files.length - gpxCount - imageCount} other file(s)`])
    setLogMessages(m => [...m, 'Parsing GPX, matching media, generating descriptions...'])

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })
      const result: ProcessResult = await res.json()
      setTour(result.tour)
      setUnmatchedFiles(result.unmatchedFiles)
      setLogMessages(m => [...m, `Created ${result.tour.stops.length} stops`, 'Done!'])

      // Fetch tour providers for review
      try {
        const tpRes = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetchProviders' }),
        })
      } catch {}

      setScreen('review')
    } catch (e: any) {
      setLogMessages(m => [...m, `Error: ${e.message}`])
    }
    setProcessing(false)
  }, [files])

  const handleAssignMedia = useCallback((fileId: string, stopId: string) => {
    if (!tour) return
    const file = files.find(f => f.id === fileId)
    if (!file) return

    setTour(prev => {
      if (!prev) return prev
      return {
        ...prev,
        stops: prev.stops.map(s => {
          if (s.id !== stopId) return s
          if (file.category === 'image') return { ...s, imageId: fileId }
          if (file.category === 'audio') return { ...s, audioId: fileId }
          if (file.category === 'video') return { ...s, videoId: fileId }
          return s
        }),
      }
    })
    setUnmatchedFiles(prev => prev.filter(f => f.id !== fileId))
  }, [tour, files])

  const handlePublish = useCallback(async (dryRun: boolean) => {
    if (!tour) return
    setPublishing(true)
    setPublishResult(null)

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour, files, dryRun }),
      })
      const result: PublishResult = await res.json()
      setPublishResult(result)
      if (result.success && !result.dryRun) setScreen('publish')
    } catch (e: any) {
      setPublishResult({ success: false, error: e.message })
    }
    setPublishing(false)
  }, [tour, files])

  const handleReset = useCallback(() => {
    setScreen('drop')
    setFiles([])
    setUnmatchedFiles([])
    setTour(null)
    setLogMessages([])
    setPublishResult(null)
  }, [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Go<span className="text-primary">Trovare</span></h1>
          {screen !== 'drop' && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Start over
            </Button>
          )}
        </div>

        {/* Drop screen */}
        {screen === 'drop' && (
          <>
            <div>
              <h2 className="text-2xl font-semibold">Upload tour files</h2>
              <p className="text-muted-foreground mt-1">
                Drop your GPX route, photos, videos, audio, and descriptions. AI will organize everything into a tour.
              </p>
            </div>
            <DropZone
              onFilesUploaded={handleFilesUploaded}
              uploading={uploading}
              setUploading={setUploading}
            />
            {files.length > 0 && !uploading && (
              <Button onClick={handleProcess} className="w-full" size="lg">
                Build tour with AI →
              </Button>
            )}
          </>
        )}

        {/* Processing screen */}
        {screen === 'processing' && (
          <ProcessingLog messages={logMessages} processing={processing} />
        )}

        {/* Review screen */}
        {screen === 'review' && tour && (
          <>
            <div>
              <h2 className="text-2xl font-semibold">Review your tour</h2>
              <p className="text-muted-foreground mt-1">
                AI has organized everything. Edit anything, assign unmatched media, then publish.
              </p>
            </div>
            <ReviewPanel
              tour={tour}
              files={files}
              unmatchedFiles={unmatchedFiles}
              tourProviders={tourProviders}
              onTourUpdate={setTour}
              onAssignMedia={handleAssignMedia}
            />
            <PublishPanel
              tour={tour}
              publishResult={publishResult}
              publishing={publishing}
              onPublish={handlePublish}
              onReset={handleReset}
            />
          </>
        )}

        {/* Publish success screen */}
        {screen === 'publish' && (
          <PublishPanel
            tour={tour!}
            publishResult={publishResult}
            publishing={false}
            onPublish={handlePublish}
            onReset={handleReset}
          />
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add main page with drop → process → review → publish flow"
```

---

## Task 17: Final integration + vercel.json

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json for Next.js**

```json
{
  "functions": {
    "app/api/upload/route.ts": { "maxDuration": 60 },
    "app/api/process/route.ts": { "maxDuration": 300 },
    "app/api/publish/route.ts": { "maxDuration": 120 }
  }
}
```

- [ ] **Step 2: Run dev server and smoke test**

```bash
pnpm dev
```

Test each screen manually:
1. Drop zone: drag a file, verify upload
2. Process: click build, verify AI runs
3. Review: verify tour/stop editing
4. Publish: run dry-run, verify JSON output

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "Configure Vercel function durations for API routes"
```

---

## Summary

| Task | Description | Key files |
|------|------------|-----------|
| 1 | Scaffold Next.js + pnpm + Tailwind + shadcn | Project root |
| 2 | Shared types + constants | `lib/types.ts`, `lib/constants.ts` |
| 3 | DO Spaces client | `lib/spaces.ts` |
| 4 | Sanity client | `lib/sanity.ts` |
| 5 | GPX parser | `lib/gpx.ts` |
| 6 | Media matcher | `lib/media-matcher.ts` |
| 7 | Duplicate detection | `lib/duplicates.ts` |
| 8 | Map image generator | `lib/map-image.ts` |
| 9 | Upload + presign API routes | `app/api/upload/`, `app/api/presign/` |
| 10 | Process API route | `app/api/process/` |
| 11 | Publish API route | `app/api/publish/` |
| 12 | Drop zone component | `app/components/drop-zone.tsx` |
| 13 | Processing log component | `app/components/processing-log.tsx` |
| 14 | Review panel + stop card | `app/components/review-panel.tsx`, etc. |
| 15 | Publish panel + dry-run | `app/components/publish-panel.tsx`, etc. |
| 16 | Main page orchestrator | `app/page.tsx` |
| 17 | Vercel config + smoke test | `vercel.json` |
