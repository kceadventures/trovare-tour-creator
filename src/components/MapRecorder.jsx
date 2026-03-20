import React, { useState, useEffect, useRef } from 'react'
import s from './MapRecorder.module.css'
export default function MapRecorder({ routePoints, pois, onRouteUpdate }) {
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const polylineRef = useRef(null)
  const watchIdRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [pointCount, setPointCount] = useState(routePoints.length)
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return
    const L = window.L
    if (!L) { setTimeout(() => { if (!leafletMapRef.current && mapRef.current) initMap() }, 1000); return }
    initMap()
    function initMap() {
      const L = window.L
      if (!L || !mapRef.current || leafletMapRef.current) return
      const map = L.map(mapRef.current).setView([20, 0], 2)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      leafletMapRef.current = map
      if (routePoints.length > 0) {
        const lls = routePoints.map(p => [p.lat, p.lng])
        polylineRef.current = L.polyline(lls, { color: '#1D9E75', weight: 4 }).addTo(map)
        map.fitBounds(polylineRef.current.getBounds(), { padding: [20,20] })
      }
    }
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null } }
  }, [])
  useEffect(() => {
    const L = window.L; const map = leafletMapRef.current
    if (!L || !map || routePoints.length < 2) return
    const lls = routePoints.map(p => [p.lat, p.lng])
    if (polylineRef.current) polylineRef.current.setLatLngs(lls)
    else polylineRef.current = L.polyline(lls, { color: '#1D9E75', weight: 4 }).addTo(map)
    if (recording) { const last = routePoints[routePoints.length-1]; map.setView([last.lat, last.lng], Math.max(map.getZoom(), 15)) }
    setPointCount(routePoints.length)
  }, [routePoints])
  const startRecording = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setError(''); setGpsStatus('active'); setRecording(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => onRouteUpdate(prev => [...prev, { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }]),
      err => { setError('GPS error: ' + err.message); setGpsStatus('error') },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }
  const stopRecording = () => { if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null } setRecording(false); setGpsStatus('idle') }
  const clearRoute = () => { onRouteUpdate([]); if (polylineRef.current && leafletMapRef.current) polylineRef.current.setLatLngs([]) }
  const exportGPX = () => {
    if (routePoints.length < 2) return
    const trkpts = routePoints.map(p => `    <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.ts).toISOString()}</time></trkpt>`).join('\n')
    const gpx = `<?xml version="1.0"?>\n<gpx version="1.1" creator="Go Trovare">\n  <trk><n>Tour Route</n><trkseg>\n${trkpts}\n  </trkseg></trk>\n</gpx>`
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx], {type:'application/gpx+xml'})); a.download = 'tour-route.gpx'; a.click()
  }
  return (
    <div className={s.container}>
      <div className={s.header}>
        <div><h3 className={s.title}>GPS Route Recording</h3><p className={s.sub}>Walk or ride your tour and record it live</p></div>
        <div className={s.stats}>
          {gpsStatus === 'active' && <span className={s.gpsActive}>● GPS active</span>}
          {pointCount > 0 && <span className={s.pointCount}>{pointCount} points</span>}
        </div>
      </div>
      <div className={s.mapWrap} ref={mapRef} />
      {error && <div className={s.error}>{error}</div>}
      <div className={s.controls}>
        {!recording ? <button className={s.btnRecord} onClick={startRecording}>● Start recording route</button> : <button className={s.btnStop} onClick={stopRecording}>■ Stop recording</button>}
        {routePoints.length > 0 && <><button className={s.btnSecondary} onClick={exportGPX}>Export GPX</button><button className={s.btnDanger} onClick={clearRoute}>Clear</button></>}
      </div>
      {routePoints.length === 0 && !recording && <div className={s.emptyState}>Press "Start recording route" to begin tracking your GPS position. Your route appears on the map in real time.</div>}
    </div>
  )
}