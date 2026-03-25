'use client'

import { motion } from 'motion/react'
import { spring } from '@/lib/motion'

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

export function RoutePreview({ routePoints, stops }: RoutePreviewProps) {
  const allPoints = [
    ...routePoints,
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
  ]

  if (!allPoints.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-muted-foreground/25 h-[180px] text-xs text-muted-foreground">
        <span>No route to preview</span>
        <span className="text-muted-foreground/60">Upload a GPX file or add stop coordinates</span>
      </div>
    )
  }

  const width = 400
  const height = 200
  const padding = 24

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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto rounded-md border border-border"
      style={{ maxHeight: 200 }}
    >
      <rect width={width} height={height} rx="8" className="fill-muted" />
      {path && (
        <motion.path
          d={path}
          fill="none"
          stroke="#1D9E75"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      )}
      {stops.map((s, i) => {
        const cx = toX(s.lng)
        const cy = toY(s.lat)
        return (
          <motion.g
            key={s.index}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring.snappy, delay: 0.3 + i * 0.1 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <circle cx={cx} cy={cy} r="10" fill="#1D9E75" />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="white"
            >
              {s.index + 1}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}
