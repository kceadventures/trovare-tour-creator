import type { UploadedFile, Stop } from './types'

const DISTANCE_THRESHOLD_M = 100

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
  const matched = new Map<string, string[]>()
  const usedFileIds = new Set<string>()

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

  const unmatched: UploadedFile[] = []
  for (const file of files) {
    if (!usedFileIds.has(file.id) && file.category !== 'gpx' && file.category !== 'text') {
      unmatched.push(file)
    }
  }

  return { matched, unmatched }
}
