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
