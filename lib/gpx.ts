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
  distance: number
}

export function parseGPX(xml: string): GPXData {
  const trackPoints: TrackPoint[] = []
  const waypoints: Waypoint[] = []

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

  let distance = 0
  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1]
    const curr = trackPoints[i]
    const R = 3958.8
    const dLat = (curr.lat - prev.lat) * Math.PI / 180
    const dLng = (curr.lng - prev.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  return { trackPoints, waypoints, distance: Math.round(distance * 10) / 10 }
}
