'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Point {
  lat: number
  lng: number
}

interface StopMarker {
  lat: number
  lng: number
  index: number
  title: string
}

interface RoutePreviewProps {
  routePoints: Point[]
  stops: StopMarker[]
}

function pointsToSvg(
  routePoints: Point[],
  stops: StopMarker[],
  width: number,
  height: number,
  padding = 20
) {
  const allPoints = [
    ...routePoints,
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
  ]
  if (!allPoints.length) return { path: '', circles: [], viewBox: `0 0 ${width} ${height}` }

  const lats = allPoints.map((p) => p.lat)
  const lngs = allPoints.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const latSpan = maxLat - minLat || 0.001
  const lngSpan = maxLng - minLng || 0.001

  const toX = (lng: number) => padding + ((lng - minLng) / lngSpan) * (width - padding * 2)
  const toY = (lat: number) => padding + ((maxLat - lat) / latSpan) * (height - padding * 2)

  const path = routePoints.length > 1
    ? routePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.lng).toFixed(1)},${toY(p.lat).toFixed(1)}`).join(' ')
    : ''

  const circles = stops.map((s) => ({
    cx: toX(s.lng),
    cy: toY(s.lat),
    index: s.index,
    title: s.title,
  }))

  return { path, circles, viewBox: `0 0 ${width} ${height}` }
}

function SvgPreview({ routePoints, stops, width, height, className }: RoutePreviewProps & { width: number; height: number; className?: string }) {
  const { path, circles, viewBox } = pointsToSvg(routePoints, stops, width, height)

  if (!routePoints.length && !stops.length) {
    return (
      <div className={`flex items-center justify-center rounded-md border border-dashed border-muted-foreground/25 text-xs text-muted-foreground ${className}`} style={{ width, height }}>
        No route data
      </div>
    )
  }

  return (
    <svg viewBox={viewBox} width={width} height={height} className={className}>
      <rect width={width} height={height} fill="var(--color-muted, #f4f4f5)" rx="8" />
      {path && (
        <path d={path} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {circles.map((c) => (
        <g key={c.index}>
          <circle cx={c.cx} cy={c.cy} r="10" fill="#1D9E75" />
          <text
            x={c.cx}
            y={c.cy + 4}
            textAnchor="middle"
            fontSize="9"
            fontWeight="bold"
            fill="white"
          >
            {c.index + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}

function LeafletMap({ routePoints, stops }: RoutePreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    import('leaflet').then((L) => {
      // Import leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([0, 0], 13)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
      }).addTo(map)

      // Add route polyline
      if (routePoints.length > 1) {
        const latlngs = routePoints.map((p) => [p.lat, p.lng] as [number, number])
        const polyline = L.polyline(latlngs, { color: '#1D9E75', weight: 4 }).addTo(map)
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] })
      }

      // Add stop markers
      stops.forEach((s) => {
        if (!s.lat || !s.lng) return
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;background:#1D9E75;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${s.index + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(`<strong>Stop ${s.index + 1}</strong><br/>${s.title}`)
          .addTo(map)
      })

      // Fit bounds to stops if no route
      if (routePoints.length <= 1 && stops.length > 0) {
        const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [30, 30] })
      }

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [routePoints, stops])

  return <div ref={mapRef} className="h-full w-full rounded-md" />
}

export function RoutePreview({ routePoints, stops }: RoutePreviewProps) {
  const [mapOpen, setMapOpen] = useState(false)

  return (
    <>
      <div
        className="cursor-pointer transition-opacity hover:opacity-80"
        onClick={() => setMapOpen(true)}
        title="Click to expand map"
      >
        <SvgPreview
          routePoints={routePoints}
          stops={stops}
          width={400}
          height={200}
          className="w-full h-auto rounded-md border border-border"
        />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Click to expand interactive map
        </p>
      </div>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-3xl h-[70vh]">
          <DialogHeader>
            <DialogTitle>Route preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full">
            {mapOpen && <LeafletMap routePoints={routePoints} stops={stops} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
