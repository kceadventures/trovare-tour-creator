import { sanity } from './sanity'
import type { DuplicateWarning, Stop } from './types'

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
