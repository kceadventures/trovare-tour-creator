import React, { useState, useEffect, useRef } from 'react'
import s from './FieldRecorder.module.css'
import { callClaude } from '../claude.js'

const KINDS = ['touristAttraction','restaurant','cafeRestaurant','shop','viewpoint','museum','park','historic','hotel','other']
const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36)

export default function FieldRecorder({ stops, routePoints, onStopsUpdate, onRouteUpdate }) {
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const polylineRef = useRef(null)
  const markersRef = useRef({})
  const watchIdRef = useRef(null)
  const [gpsActive, setGpsActive] = useState(false)
  const [mapError, setMapError] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('')
  const [audioRecording, setAudioRecording] = useState({})
  const [audioUrls, setAudioUrls] = useState({})
  const [audioRecorders, setAudioRecorders] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [transcripts, setTranscripts] = useState({})
  const [aiLoading, setAiLoading] = useState({})
  const [aiStatus, setAiStatus] = useState({})
  const timerRefs = useRef({})
  const currentPos = useRef(null)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return
    const tryInit = () => {
      const L = window.L
      if (!L) { setTimeout(tryInit, 500); return }
      const map = L.map(mapRef.current).setView([42.0, -72.0], 8)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      leafletMapRef.current = map
      redrawMap(map, routePoints, stops)
    }
    tryInit()
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null } }
  }, [])

  useEffect(() => { if (leafletMapRef.current) redrawMap(leafletMapRef.current, routePoints, stops) }, [routePoints, stops])

  const redrawMap = (map, pts, stps) => {
    const L = window.L; if (!L) return
    if (pts.length > 1) {
      const lls = pts.map(p => [p.lat, p.lng])
      if (polylineRef.current) polylineRef.current.setLatLngs(lls)
      else polylineRef.current = L.polyline(lls, { color: '#1D9E75', weight: 4, opacity: 0.8 }).addTo(map)
    }
    Object.values(markersRef.current).forEach(m => map.removeLayer(m))
    markersRef.current = {}
    stps.forEach((stop, i) => {
      if (stop.lat && stop.lng) {
        const icon = L.divIcon({ className: '', html: `<div style="width:28px;height:28px;background:#1D9E75;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i+1}</div>`, iconSize: [28,28], iconAnchor: [14,14] })
        const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map).bindPopup(stop.title || `Stop ${i+1}`)
        markersRef.current[stop.id] = marker
      }
    })
  }

  const startGPS = () => {
    if (!navigator.geolocation) { setMapError('Geolocation not supported'); return }
    setMapError(''); setGpsActive(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        currentPos.current = { lat, lng }
        onRouteUpdate(prev => [...prev, { lat, lng, ts: Date.now() }])
        if (leafletMapRef.current) leafletMapRef.current.setView([lat, lng], Math.max(leafletMapRef.current.getZoom(), 15))
      },
      err => { setMapError('GPS: ' + err.message); setGpsActive(false) },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  const stopGPS = () => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    setGpsActive(false)
  }

  const markStop = () => {
    const pos = currentPos.current
    const id = genId()
    onStopsUpdate(prev => [...prev, { id, title: '', kind: 'touristAttraction', lat: pos ? pos.lat.toFixed(6) : '', lng: pos ? pos.lng.toFixed(6) : '', details: '', audioUrl: '', videoUrl: '', imageUrl: '', expanded: true }])
  }

  const addManualStop = () => {
    const id = genId()
    onStopsUpdate(prev => [...prev, { id, title: '', kind: 'touristAttraction', lat: '', lng: '', details: '', audioUrl: '', videoUrl: '', imageUrl: '', expanded: true }])
  }

  const updateStop = (id, field, value) => onStopsUpdate(prev => prev.map(s => s.id === id ? {...s, [field]: value} : s))
  const removeStop = id => onStopsUpdate(prev => prev.filter(s => s.id !== id))
  const toggleStop = id => updateStop(id, 'expanded', !stops.find(s=>s.id===id)?.expanded)

  const startAudio = async (stopId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const mr = new window.MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => { setAudioUrls(prev => ({...prev, [stopId]: URL.createObjectURL(new Blob(chunks, {type:'audio/webm'}))})); stream.getTracks().forEach(t=>t.stop()) }
      mr.start(500)
      setAudioRecorders(prev => ({...prev, [stopId]: mr}))
      setAudioRecording(prev => ({...prev, [stopId]: true}))
      setAudioDuration(prev => ({...prev, [stopId]: 0}))
      timerRefs.current[stopId] = setInterval(() => setAudioDuration(prev => ({...prev, [stopId]: (prev[stopId]||0)+1})), 1000)
    } catch(e) { alert('Mic access denied: ' + e.message) }
  }

  const stopAudio = (stopId) => {
    clearInterval(timerRefs.current[stopId])
    const mr = audioRecorders[stopId]
    if (mr && mr.state !== 'inactive') mr.stop()
    setAudioRecording(prev => ({...prev, [stopId]: false}))
  }

  const fmtDur = sec => `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`

  const transcribeAndGenerate = async (stopId) => {
    const stop = stops.find(s => s.id === stopId)
    const rawNotes = transcripts[stopId] || ''
    if (!stop?.title && !rawNotes) { alert('Add a stop name or field notes first'); return }
    setAiLoading(prev => ({...prev, [stopId]: true}))
    setAiStatus(prev => ({...prev, [stopId]: '✦ Searching web & writing...'}))
    try {
      const text = await callClaude({
        prompt: `Write a stop description for "${stop.title || 'this location'}" (category: ${stop.kind})${stop.lat ? ` at ${stop.lat}, ${stop.lng}` : ''}. ${rawNotes ? `Field notes: "${rawNotes}"` : ''} Search for real historical facts and practical details before writing.`,
        system: 'You write rich, accurate stop descriptions for Go Trovare, a self-guided travel app for curious travelers. Style: warm, knowledgeable, second-person. 2-3 tight paragraphs. Include historical facts, what to notice, practical tips. No generic filler. Return ONLY the final description text.',
        useWebSearch: true,
        maxTokens: 1200
      })
      if (text) { updateStop(stopId, 'details', text); setAiStatus(prev => ({...prev, [stopId]: '✦ Written with web research'})) }
      else setAiStatus(prev => ({...prev, [stopId]: 'No content returned — try again'}))
    } catch(e) { setAiStatus(prev => ({...prev, [stopId]: 'Error: ' + e.message})) }
    setAiLoading(prev => ({...prev, [stopId]: false}))
  }

  const refineNotes = async (stopId) => {
    const stop = stops.find(s => s.id === stopId)
    const rawNotes = transcripts[stopId] || stop?.details || ''
    if (!rawNotes) { alert('Add field notes or a rough description first'); return }
    setAiLoading(prev => ({...prev, [stopId+'_r']: true}))
    setAiStatus(prev => ({...prev, [stopId]: '✦ Polishing your notes...'}))
    try {
      const text = await callClaude({
        prompt: `Stop: "${stop.title}". Raw notes: "${rawNotes}"`,
        system: 'Refine rough field notes into a polished stop description for Go Trovare, a self-guided travel app. Keep all specific details and local knowledge. Polish the language, warm second-person voice, 2-3 paragraphs. Return ONLY the polished description.',
        maxTokens: 1000
      })
      if (text) { updateStop(stopId, 'details', text); setAiStatus(prev => ({...prev, [stopId]: '✦ Polished'})) }
    } catch(e) { setAiStatus(prev => ({...prev, [stopId]: 'Error: ' + e.message})) }
    setAiLoading(prev => ({...prev, [stopId+'_r']: false}))
  }

  const geocodeStop = async (stopId) => {
    const stop = stops.find(s => s.id === stopId)
    if (!stop?.title) { alert('Add a stop name first'); return }
    setAiStatus(prev => ({...prev, [stopId]: '✦ Finding location...'}))
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(stop.title)}&format=json&limit=1`)
      const data = await res.json()
      if (data[0]) {
        updateStop(stopId, 'lat', parseFloat(data[0].lat).toFixed(6))
        updateStop(stopId, 'lng', parseFloat(data[0].lon).toFixed(6))
        setAiStatus(prev => ({...prev, [stopId]: `✦ Found: ${data[0].display_name.split(',').slice(0,2).join(',')}`}))
        if (leafletMapRef.current) leafletMapRef.current.setView([data[0].lat, data[0].lon], 15)
      } else setAiStatus(prev => ({...prev, [stopId]: 'Not found — enter manually'}))
    } catch(e) { setAiStatus(prev => ({...prev, [stopId]: 'Geocode error'})) }
  }

  const translateStop = async (stopId, lang) => {
    const stop = stops.find(s => s.id === stopId)
    if (!stop?.details) { alert('Generate a description first'); return }
    setAiLoading(prev => ({...prev, [stopId+'_t']: true}))
    setAiStatus(prev => ({...prev, [stopId]: `✦ Translating to ${lang}...`}))
    try {
      const text = await callClaude({
        prompt: stop.details,
        system: `Translate the following travel stop description to ${lang}. Preserve all tone, details and formatting. Return only the translated text.`,
        maxTokens: 1000
      })
      if (text) { updateStop(stopId, 'details', text); setAiStatus(prev => ({...prev, [stopId]: `✦ Translated to ${lang}`})) }
    } catch(e) { setAiStatus(prev => ({...prev, [stopId]: 'Translation error: ' + e.message})) }
    setAiLoading(prev => ({...prev, [stopId+'_t']: false}))
  }

  const generateBulk = async () => {
    if (!bulkText.trim()) return
    const names = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    setBulkLoading(true); setBulkStatus(`Searching web & generating ${names.length} stops...`)
    try {
      const raw = await callClaude({
        prompt: `Generate stop descriptions for these locations: ${names.join(', ')}. Search for real facts about each. Return a JSON array only (no markdown), each item: { title, kind, details }`,
        system: 'You generate structured tour stop data for Go Trovare. Return ONLY a valid JSON array, no markdown fences. Each item needs: title (string), kind (one of: touristAttraction/restaurant/cafeRestaurant/shop/viewpoint/museum/park/historic/hotel/other), details (2-3 paragraphs, warm second-person, real facts).',
        useWebSearch: true,
        maxTokens: 3000
      })
      const match = raw.match(/\[.*\]/s)
      if (match) {
        const parsed = JSON.parse(match[0])
        const newStops = parsed.map(p => ({ id: genId(), title: p.title||'', kind: p.kind||'touristAttraction', lat: '', lng: '', details: p.details||'', audioUrl: '', videoUrl: '', imageUrl: '', expanded: false }))
        onStopsUpdate(prev => [...prev, ...newStops])
        setBulkStatus(`✦ ${newStops.length} stops generated`)
        setBulkText('')
      } else { setBulkStatus('Could not parse response — try again') }
    } catch(e) { setBulkStatus('Error: ' + e.message) }
    setBulkLoading(false)
  }

  const dist = routePoints.length > 1 ? routePoints.reduce((acc, p, i) => {
    if (i === 0) return 0
    const prev = routePoints[i-1], R = 3958.8
    const dLat=(p.lat-prev.lat)*Math.PI/180, dLon=(p.lng-prev.lng)*Math.PI/180
    const a=Math.sin(dLat/2)**2+Math.cos(prev.lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dLon/2)**2
    return acc + R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  }, 0).toFixed(2) : 0

  return (
    <div className={s.container}>
      <div className={s.recordingBar}>
        <div className={s.recHeader}>
          <div className={s.recTitle}>Live Route Recording</div>
          <div className={`${s.gpsStatus} ${gpsActive ? s.gpsActive : ''}`}><span className={s.gpsDot}/>{gpsActive ? 'GPS tracking' : 'GPS off'}</div>
        </div>
        <div className={s.mapWrap} ref={mapRef}/>
        {routePoints.length > 0 && <div className={s.routeStats}><div className={s.stat}><strong>{routePoints.length}</strong>GPS points</div><div className={s.stat}><strong>{dist}</strong>miles</div><div className={s.stat}><strong>{stops.length}</strong>stops</div></div>}
        {mapError && <div className={s.error}>{mapError}</div>}
        <div className={s.recControls}>
          {!gpsActive ? <button className={s.btnStartRec} onClick={startGPS}>● Start GPS recording</button> : <button className={s.btnStopRec} onClick={stopGPS}>■ Stop GPS</button>}
          <button className={s.btnMarkStop} onClick={markStop} disabled={!gpsActive && !currentPos.current}>📍 Mark stop here</button>
          {routePoints.length > 1 && <button className={s.btnGpx} onClick={() => { const trkpts=routePoints.map(p=>`    <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.ts).toISOString()}</time></trkpt>`).join('\n'); const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([`<?xml version="1.0"?>\n<gpx version="1.1"><trk><n>Tour</n><trkseg>\n${trkpts}\n</trkseg></trk></gpx>`]));a.download='tour.gpx';a.click() }}>Export GPX</button>}
        </div>
      </div>

      <div className={s.bulkSection}>
        <div className={s.bulkTitle}>✦ Generate stops from a list</div>
        <div className={s.bulkSub}>Paste stop names (one per line) — AI searches the web and writes all descriptions at once</div>
        <textarea className={s.bulkTextarea} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"The Louvre\nNotre-Dame Cathedral\nPont Neuf"} rows={4}/>
        <button className={s.btnBulk} onClick={generateBulk} disabled={bulkLoading||!bulkText.trim()}>{bulkLoading ? 'Generating...' : `✦ Generate ${bulkText.trim().split('\n').filter(Boolean).length||''} stops with AI`}</button>
        {bulkStatus && <div className={s.bulkStatus}>{bulkStatus}</div>}
      </div>

      <div className={s.stopsList}>
        {stops.length === 0 && <div className={s.emptyState}>No stops yet. Start GPS and tap "Mark stop here" as you walk,<br/>or paste a list of names above to generate stops instantly.</div>}
        {stops.map((stop, idx) => (
          <div key={stop.id} className={s.stopCard}>
            <div className={s.stopHeader}>
              <div className={s.stopNum}>{idx+1}</div>
              <div className={s.stopName}>{stop.title || 'Untitled stop'}</div>
              {stop.lat && <div className={s.stopCoord}>{parseFloat(stop.lat).toFixed(4)}, {parseFloat(stop.lng).toFixed(4)}</div>}
              <div className={s.stopActions}>
                <button className={s.iconBtn} onClick={() => toggleStop(stop.id)}>{stop.expanded?'▲':'▼'}</button>
                <button className={s.iconBtn} style={{color:'#e55'}} onClick={() => removeStop(stop.id)}>✕</button>
              </div>
            </div>
            {stop.expanded && (
              <div className={s.stopBody}>
                <div className={s.audioCapture}>
                  <div className={s.audioCaptureTitle}>🎙 Voice notes</div>
                  <div className={s.audioControls}>
                    {!audioRecording[stop.id] ? <button className={s.btnAudioRec} onClick={() => startAudio(stop.id)}>● Record</button> : <><div className={s.recBadge}><span className={s.recDot}/>{fmtDur(audioDuration[stop.id]||0)}</div><button className={s.btnAudioStop} onClick={() => stopAudio(stop.id)}>■ Stop</button></>}
                  </div>
                  {audioUrls[stop.id] && <audio src={audioUrls[stop.id]} controls className={s.audioPlayer}/>}
                  <div className={s.field} style={{marginTop:8}}>
                    <label>Transcript / field notes</label>
                    <textarea value={transcripts[stop.id]||''} onChange={e => setTranscripts(prev=>({...prev,[stop.id]:e.target.value}))} placeholder="Type what you recorded, or rough notes about this stop..." rows={3}/>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <div className={s.field}><label>Stop name *</label><input type="text" value={stop.title} onChange={e=>updateStop(stop.id,'title',e.target.value)} placeholder="e.g. Old Mill at Bantam Lake"/></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className={s.field}><label>Category</label><select value={stop.kind} onChange={e=>updateStop(stop.id,'kind',e.target.value)}>{KINDS.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
                    <div className={s.field}><label>Translate to...</label><select onChange={e=>{if(e.target.value)translateStop(stop.id,e.target.value);e.target.value=''}} defaultValue=""><option value="">Translate to...</option>{['Spanish','French','Italian','German','Portuguese','Japanese','Chinese','Arabic'].map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className={s.field}><label>Latitude</label><input type="text" value={stop.lat} onChange={e=>updateStop(stop.id,'lat',e.target.value)} placeholder="Auto-filled or manual"/></div>
                    <div className={s.field}><label>Longitude</label><input type="text" value={stop.lng} onChange={e=>updateStop(stop.id,'lng',e.target.value)} placeholder="Auto-filled or manual"/></div>
                  </div>
                  <div className={s.field}>
                    <label>Description</label>
                    <textarea value={stop.details} onChange={e=>updateStop(stop.id,'details',e.target.value)} placeholder="AI will fill this in, or write manually..." rows={4}/>
                    <div className={s.aiRow}>
                      <button className={s.btnAI} onClick={()=>transcribeAndGenerate(stop.id)} disabled={aiLoading[stop.id]}>
                        {aiLoading[stop.id] ? '✦ Researching...' : '✦ Write with web research'}
                      </button>
                      <button className={s.btnAI} onClick={()=>refineNotes(stop.id)} disabled={aiLoading[stop.id+'_r']}>
                        {aiLoading[stop.id+'_r'] ? '✦ Polishing...' : '✦ Polish my notes'}
                      </button>
                      <button className={s.btnAI} onClick={()=>geocodeStop(stop.id)}>📍 Find coords</button>
                    </div>
                    {aiStatus[stop.id] && <div className={s.aiStatus}>{aiStatus[stop.id]}</div>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className={s.field}><label>Audio (Supabase path)</label><input type="text" value={stop.audioUrl||''} onChange={e=>updateStop(stop.id,'audioUrl',e.target.value)} placeholder="media/audios/file.mp3"/></div>
                    <div className={s.field}><label>Image URL</label><input type="text" value={stop.imageUrl||''} onChange={e=>updateStop(stop.id,'imageUrl',e.target.value)} placeholder="https://..."/></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className={s.addStopBtn} onClick={addManualStop}>+ Add stop manually</button>
    </div>
  )
}