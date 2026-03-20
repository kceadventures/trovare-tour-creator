import React, { useState, useEffect, useRef } from 'react'
import s from './FieldRecorder.module.css'
import { callClaude } from '../claude.js'

const KINDS = ['touristAttraction','restaurant','cafeRestaurant','shop','viewpoint','museum','park','historic','hotel','other']
const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36)

export default function FieldRecorder({ stops, routePoints, onStopsUpdate, onRouteUpdate }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const polyline = useRef(null)
  const pinMarkers = useRef({})
  const watchId = useRef(null)
  const currentPos = useRef(null)
  const timerRefs = useRef({})

  const [gpsOn, setGpsOn] = useState(false)
  const [mapErr, setMapErr] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  const [audioRec, setAudioRec] = useState({})      // stopId -> bool
  const [audioUrl, setAudioUrl] = useState({})       // stopId -> blobUrl
  const [audioMr, setAudioMr] = useState({})         // stopId -> MediaRecorder
  const [audioDur, setAudioDur] = useState({})       // stopId -> seconds
  const [notes, setNotes] = useState({})             // stopId -> transcript text
  const [expanded, setExpanded] = useState({})       // stopId -> bool
  const [aiLoading, setAiLoading] = useState({})
  const [aiMsg, setAiMsg] = useState({})

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const init = () => {
      const L = window.L; if (!L) { setTimeout(init, 400); return }
      const map = L.map(mapRef.current).setView([42, -72], 8)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map)
      mapInstance.current = map
    }
    init()
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null } }
  }, [])

  // Redraw route + pins whenever data changes
  useEffect(() => {
    const L = window.L; const map = mapInstance.current; if (!L || !map) return
    if (routePoints.length > 1) {
      const lls = routePoints.map(p => [p.lat, p.lng])
      if (polyline.current) polyline.current.setLatLngs(lls)
      else { polyline.current = L.polyline(lls, { color: '#1D9E75', weight: 4 }).addTo(map) }
    }
    Object.values(pinMarkers.current).forEach(m => map.removeLayer(m))
    pinMarkers.current = {}
    stops.forEach((st, i) => {
      if (!st.lat || !st.lng) return
      const icon = L.divIcon({ className: '', html: `<div style="width:26px;height:26px;background:#1D9E75;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">${i+1}</div>`, iconSize:[26,26], iconAnchor:[13,13] })
      pinMarkers.current[st.id] = L.marker([st.lat, st.lng], { icon }).addTo(map).bindPopup(st.title||`Stop ${i+1}`)
    })
  }, [routePoints, stops])

  // GPS
  const toggleGPS = () => {
    if (gpsOn) {
      if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null }
      setGpsOn(false); return
    }
    if (!navigator.geolocation) { setMapErr('Geolocation not supported'); return }
    setMapErr(''); setGpsOn(true)
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        currentPos.current = { lat, lng }
        onRouteUpdate(prev => [...prev, { lat, lng, ts: Date.now() }])
        if (mapInstance.current) mapInstance.current.setView([lat, lng], Math.max(mapInstance.current.getZoom(), 15))
      },
      err => { setMapErr(err.message); setGpsOn(false) },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  const markHere = () => {
    const pos = currentPos.current
    const id = genId()
    onStopsUpdate(prev => [...prev, { id, title: '', kind: 'touristAttraction', lat: pos?.lat?.toFixed(6)||'', lng: pos?.lng?.toFixed(6)||'', details: '', audioUrl: '', imageUrl: '', expanded: true }])
    setExpanded(e => ({...e, [id]: true}))
  }

  const exportGPX = () => {
    const pts = routePoints.map(p => `  <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.ts||0).toISOString()}</time></trkpt>`).join('\n')
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><n>Tour</n><trkseg>\n${pts}\n</trkseg></trk></gpx>`
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx])); a.download = 'tour-route.gpx'; a.click()
  }

  // Stop mutations
  const addStop = () => {
    const id = genId()
    onStopsUpdate(prev => [...prev, { id, title:'', kind:'touristAttraction', lat:'', lng:'', details:'', audioUrl:'', imageUrl:'' }])
    setTimeout(() => { document.getElementById('name-'+id)?.focus() }, 50)
  }
  const upd = (id, f, v) => onStopsUpdate(prev => prev.map(s => s.id===id ? {...s,[f]:v} : s))
  const del = id => onStopsUpdate(prev => prev.filter(s => s.id !== id))
  const toggleExpand = id => setExpanded(e => ({...e, [id]: !e[id]}))

  // Audio
  const toggleAudio = async (id) => {
    if (audioRec[id]) {
      clearInterval(timerRefs.current[id])
      if (audioMr[id]?.state !== 'inactive') audioMr[id].stop()
      setAudioRec(r => ({...r, [id]: false}))
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const chunks = []; const mr = new window.MediaRecorder(stream)
        mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        mr.onstop = () => { setAudioUrl(u => ({...u, [id]: URL.createObjectURL(new Blob(chunks, {type:'audio/webm'}))})); stream.getTracks().forEach(t=>t.stop()) }
        mr.start(500)
        setAudioMr(m => ({...m, [id]: mr}))
        setAudioRec(r => ({...r, [id]: true}))
        setAudioDur(d => ({...d, [id]: 0}))
        timerRefs.current[id] = setInterval(() => setAudioDur(d => ({...d, [id]: (d[id]||0)+1})), 1000)
      } catch(e) { alert('Mic access denied: ' + e.message) }
    }
  }

  const fmtDur = n => `${Math.floor(n/60)}:${(n%60).toString().padStart(2,'0')}`

  // AI
  const aiWrite = async (id) => {
    const st = stops.find(s=>s.id===id)
    if (!st?.title && !notes[id]) { alert('Add a stop name or voice notes first'); return }
    setAiLoading(l=>({...l,[id]:true})); setAiMsg(m=>({...m,[id]:'Searching & writing...'}))
    try {
      const text = await callClaude({
        prompt: `Write a stop description for "${st.title||'this location'}" (${st.kind})${st.lat?` at ${st.lat},${st.lng}`:''}.${notes[id]?' Notes: "'+notes[id]+'"':''} Search for real facts first.`,
        system: 'Write rich, accurate stop descriptions for Go Trovare, a self-guided travel app. Warm, knowledgeable, second-person. 2-3 paragraphs with real historical facts and practical tips. Return ONLY the description text.',
        useWebSearch: true, maxTokens: 1200
      })
      if (text) { upd(id,'details',text); setAiMsg(m=>({...m,[id]:'✦ Done'})) }
    } catch(e) { setAiMsg(m=>({...m,[id]:'Error: '+e.message})) }
    setAiLoading(l=>({...l,[id]:false}))
  }

  const aiPolish = async (id) => {
    const st = stops.find(s=>s.id===id)
    const raw = notes[id] || st?.details
    if (!raw) { alert('Add some notes or a draft description first'); return }
    setAiLoading(l=>({...l,[id+'p']:true})); setAiMsg(m=>({...m,[id]:'Polishing...'}))
    try {
      const text = await callClaude({
        prompt: `Stop: "${st.title}". Notes: "${raw}"`,
        system: 'Polish rough field notes into a Go Trovare stop description. Keep all specific local details. Warm second-person voice, 2-3 paragraphs. Return ONLY the polished text.',
        maxTokens: 1000
      })
      if (text) { upd(id,'details',text); setAiMsg(m=>({...m,[id]:'✦ Polished'})) }
    } catch(e) { setAiMsg(m=>({...m,[id]:'Error'})) }
    setAiLoading(l=>({...l,[id+'p']:false}))
  }

  const findCoords = async (id) => {
    const st = stops.find(s=>s.id===id); if (!st?.title) { alert('Add a stop name first'); return }
    setAiMsg(m=>({...m,[id]:'Finding...'}))
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(st.title)}&format=json&limit=1`)
      const d = await res.json()
      if (d[0]) { upd(id,'lat',parseFloat(d[0].lat).toFixed(6)); upd(id,'lng',parseFloat(d[0].lon).toFixed(6)); setAiMsg(m=>({...m,[id]:'✦ Found'})); if(mapInstance.current) mapInstance.current.setView([d[0].lat,d[0].lon],15) }
      else setAiMsg(m=>({...m,[id]:'Not found'}))
    } catch { setAiMsg(m=>({...m,[id]:'Error'})) }
  }

  const bulkGenerate = async () => {
    const names = bulkText.split('\n').map(l=>l.trim()).filter(Boolean); if (!names.length) return
    setBulkLoading(true); setBulkMsg(`Writing ${names.length} stops...`)
    try {
      const raw = await callClaude({
        prompt: `Generate stop descriptions for: ${names.join(', ')}. Return a JSON array only, each item: {title, kind, details}`,
        system: 'Return ONLY a valid JSON array, no markdown. Each: title (string), kind (touristAttraction/restaurant/cafeRestaurant/shop/viewpoint/museum/park/historic/hotel/other), details (2-3 paras, warm second-person).',
        useWebSearch: true, maxTokens: 3000
      })
      const match = raw.match(/\[.*\]/s)
      if (match) {
        const parsed = JSON.parse(match[0])
        onStopsUpdate(prev => [...prev, ...parsed.map(p => ({ id:genId(), title:p.title||'', kind:p.kind||'touristAttraction', lat:'', lng:'', details:p.details||'', audioUrl:'', imageUrl:'' }))])
        setBulkMsg(`✦ ${parsed.length} stops added`); setBulkText('')
      }
    } catch(e) { setBulkMsg('Error: '+e.message) }
    setBulkLoading(false)
  }

  const dist = routePoints.length > 1 ? routePoints.reduce((acc,p,i)=>{
    if(!i) return 0; const pr=routePoints[i-1],R=3958.8
    const dlat=(p.lat-pr.lat)*Math.PI/180,dlon=(p.lng-pr.lng)*Math.PI/180
    const a=Math.sin(dlat/2)**2+Math.cos(pr.lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dlon/2)**2
    return acc+R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  },0).toFixed(1) : 0

  return (
    <div className={s.wrap}>

      {/* Map with controls overlaid */}
      <div className={s.mapBox}>
        <div className={s.mapEl} ref={mapRef}/>
        <div className={s.mapOverlay}>
          <button className={`${s.gpsBtn} ${gpsOn?s.active:''}`} onClick={toggleGPS}>
            <span className={`${s.gpsLabel} ${gpsOn?s.gpsActive:''}`}><span className={s.gpsDot}/></span>
            {gpsOn ? 'Stop GPS' : '● Record route'}
          </button>
          <button className={s.markBtn} onClick={markHere} disabled={!gpsOn && !currentPos.current}>
            📍 Mark stop
          </button>
          {routePoints.length > 1 && <button className={s.gpxBtn} onClick={exportGPX}>GPX ↓</button>}
        </div>
      </div>

      {/* Route stats */}
      {routePoints.length > 0 && (
        <div className={s.statRow}>
          <div className={s.stat}><strong>{routePoints.length}</strong> pts</div>
          <div className={s.stat}><strong>{dist}</strong> mi</div>
          <div className={s.stat}><strong>{stops.length}</strong> stops</div>
        </div>
      )}
      {mapErr && <div style={{fontSize:12,color:'#c33',marginTop:6}}>{mapErr}</div>}

      {/* Bulk generate - collapsed by default */}
      <details style={{marginTop:16,marginBottom:8}}>
        <summary style={{fontSize:13,color:'#888',cursor:'pointer',userSelect:'none',listStyle:'none',display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:16}}>✦</span> Generate stops from a list
        </summary>
        <div className={s.bulkBox} style={{marginTop:10}}>
          <div className={s.bulkSub}>One stop name per line — AI searches the web and writes all descriptions</div>
          <textarea className={s.bulkTA} value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={"Eiffel Tower\nLe Marais\nPont Neuf"} rows={4}/>
          <button className={s.bulkBtn} onClick={bulkGenerate} disabled={bulkLoading||!bulkText.trim()}>
            {bulkLoading ? 'Writing...' : `✦ Generate ${bulkText.trim().split('\n').filter(Boolean).length||''} stops`}
          </button>
          {bulkMsg && <div className={s.bulkStatus}>{bulkMsg}</div>}
        </div>
      </details>

      {/* Stop list */}
      <div className={s.stopsList}>
        {!stops.length && (
          <div className={s.emptyHint}>
            Hit <strong>Record route</strong> and tap <strong>Mark stop</strong> as you go,<br/>
            or just type stop names below.
          </div>
        )}

        {stops.map((st, idx) => {
          const isExpanded = expanded[st.id]
          const hasDesc = !!st.details
          const hasCoord = st.lat && st.lng
          return (
            <div key={st.id} className={s.stopRow}>
              {/* Always-visible row */}
              <div className={s.stopTop}>
                <div className={s.stopBadge}>{idx+1}</div>
                <input
                  id={'name-'+st.id}
                  className={s.stopNameInput}
                  value={st.title}
                  onChange={e => upd(st.id,'title',e.target.value)}
                  placeholder="Stop name..."
                  onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); addStop() } }}
                />
                <div className={s.stopChips}>
                  {/* Audio chip */}
                  <button
                    className={`${s.chip} ${audioRec[st.id]?s.recording:audioUrl[st.id]?s.active:''}`}
                    onClick={() => toggleAudio(st.id)}
                  >
                    🎙 {audioRec[st.id] ? fmtDur(audioDur[st.id]||0) : audioUrl[st.id] ? '✓' : ''}
                  </button>
                  {/* AI chip */}
                  <button
                    className={`${s.chip} ${hasDesc?s.active:''}`}
                    onClick={() => { if (!isExpanded) setExpanded(e=>({...e,[st.id]:true})); aiWrite(st.id) }}
                    disabled={aiLoading[st.id]}
                  >
                    {aiLoading[st.id] ? '...' : hasDesc ? '✦ edit' : '✦ write'}
                  </button>
                  {/* Pin chip */}
                  <button
                    className={`${s.chip} ${hasCoord?s.active:''}`}
                    onClick={() => findCoords(st.id)}
                    title="Find coordinates"
                  >
                    {hasCoord ? '📍' : '📍?'}
                  </button>
                  {/* Expand */}
                  <button className={s.chip} onClick={() => toggleExpand(st.id)}>
                    {isExpanded ? '▲' : '···'}
                  </button>
                  <button className={s.removeChip} onClick={() => del(st.id)}>×</button>
                </div>
              </div>

              {/* Expanded detail — only when needed */}
              {isExpanded && (
                <div className={s.stopDetail}>
                  {audioUrl[st.id] && <audio src={audioUrl[st.id]} controls className={s.audioPlayer}/>}
                  <div>
                    <div className={s.fieldLabel}>Field notes</div>
                    <textarea
                      className={s.notesTA}
                      value={notes[st.id]||''}
                      onChange={e=>setNotes(n=>({...n,[st.id]:e.target.value}))}
                      placeholder="What did you record? Rough impressions, history, tips..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <div className={s.fieldLabel}>Description</div>
                    <textarea className={s.descTA} value={st.details} onChange={e=>upd(st.id,'details',e.target.value)} placeholder="AI will write this, or type manually..."/>
                    <div className={s.aiRow} style={{marginTop:7}}>
                      <button className={s.aiBtn} onClick={()=>aiWrite(st.id)} disabled={aiLoading[st.id]}>{aiLoading[st.id]?'Writing...':'✦ Write with research'}</button>
                      <button className={s.aiBtn} onClick={()=>aiPolish(st.id)} disabled={aiLoading[st.id+'p']}>{aiLoading[st.id+'p']?'Polishing...':'✦ Polish notes'}</button>
                    </div>
                    {aiMsg[st.id] && <div className={s.aiStatus} style={{marginTop:5}}>{aiMsg[st.id]}</div>}
                  </div>
                  <div className={s.detailRow}>
                    <div>
                      <div className={s.fieldLabel}>Category</div>
                      <select className={s.miniSelect} value={st.kind} onChange={e=>upd(st.id,'kind',e.target.value)}>
                        {KINDS.map(k=><option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className={s.fieldLabel}>Translate</div>
                      <select className={s.miniSelect} onChange={e=>{
                        if(!e.target.value) return
                        const lang=e.target.value; e.target.value=''
                        ;(async()=>{
                          const st2=stops.find(s=>s.id===st.id); if(!st2?.details) return
                          setAiMsg(m=>({...m,[st.id]:`Translating to ${lang}...`}))
                          try{const t=await callClaude({prompt:st2.details,system:`Translate to ${lang}. Preserve tone and details. Return only translated text.`,maxTokens:1000});if(t){upd(st.id,'details',t);setAiMsg(m=>({...m,[st.id]:`✦ ${lang}`}))}}catch{setAiMsg(m=>({...m,[st.id]:'Translation error'}))}
                        })()
                      }} defaultValue="">
                        <option value="">Translate to...</option>
                        {['Spanish','French','Italian','German','Portuguese','Japanese','Chinese','Arabic'].map(l=><option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={s.detailRow}>
                    <div>
                      <div className={s.fieldLabel}>Lat</div>
                      <input className={s.miniInput} value={st.lat} onChange={e=>upd(st.id,'lat',e.target.value)} placeholder="auto or manual"/>
                    </div>
                    <div>
                      <div className={s.fieldLabel}>Lng</div>
                      <input className={s.miniInput} value={st.lng} onChange={e=>upd(st.id,'lng',e.target.value)} placeholder="auto or manual"/>
                    </div>
                  </div>
                  <div>
                    <div className={s.fieldLabel}>Audio (Supabase path)</div>
                    <input className={s.miniInput} value={st.audioUrl} onChange={e=>upd(st.id,'audioUrl',e.target.value)} placeholder="media/audios/file.mp3"/>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className={s.addBtn} onClick={addStop}>+ Add stop</button>
    </div>
  )
}