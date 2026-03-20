import React, { useState, useEffect, useRef } from 'react'
import s from './App.module.css'

const SANITY_PROJECT = '48sx65rc'
const SANITY_DATASET = 'production'
const SANITY_VER = 'v2022-03-07'
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const REGIONS = [
  {_id:'f62ad0f8-efa5-4870-be0e-e0647ad25cfb',title:'Cannon Beach'},
  {_id:'585c28d9-6212-4a9e-b124-f9c8102dff3a',title:'Casablanca'},
  {_id:'c5bd0b4c-a671-4939-af44-7d8cee79b739',title:'Colombian Highlands'},
  {_id:'d68d9de9-563c-415d-86fb-fcb621e12c58',title:'Copenhagen'},
  {_id:'46c56d61-4174-42b8-803d-f34361858510',title:'Edinburgh'},
  {_id:'8ab3a446-3359-42fe-ad20-414264314151',title:'Gran Canaria'},
  {_id:'f98b5496-91b4-4271-8d24-e5e528d83cdc',title:'Kyoto'},
  {_id:'a51a17e1-b7ad-43e1-a493-3cb12c4c643b',title:'Marrakesh'},
]

// Screens: 'walk' | 'audio' | 'processing' | 'review' | 'publish'
const EMPTY = { stops: [], routePoints: [], tourTitle: '', tourType: 'walk', challengeLevel: 2, distance: '', duration: '', regionId: '', regionTitle: '' }

export default function App() {
  const [screen, setScreen] = useState('walk')
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem('trovare_v3')||'null') || EMPTY } catch { return EMPTY } })
  const [gpsOn, setGpsOn] = useState(false)
  const [gpsErr, setGpsErr] = useState('')
  const [audioRec, setAudioRec] = useState({})
  const [audioUrl, setAudioUrl] = useState({})
  const [audioMr, setAudioMr] = useState({})
  const [audioDur, setAudioDur] = useState({})
  const [aiLog, setAiLog] = useState([])
  const [processing, setProcessing] = useState(false)
  const [publishToken, setPublishToken] = useState(() => localStorage.getItem('trovare_token')||'')
  const [publishState, setPublishState] = useState('')
  const [publishErr, setPublishErr] = useState('')
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const polyline = useRef(null)
  const pins = useRef({})
  const watchId = useRef(null)
  const currentPos = useRef(null)
  const timerRefs = useRef({})

  useEffect(() => { localStorage.setItem('trovare_v3', JSON.stringify(data)) }, [data])

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInst.current || screen !== 'walk') return
    const init = () => {
      const L = window.L; if (!L) { setTimeout(init, 400); return }
      const map = L.map(mapRef.current, { zoomControl: false }).setView([42, -72], 8)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OSM © CARTO' }).addTo(map)
      mapInst.current = map
    }
    init()
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [screen])

  useEffect(() => {
    const L = window.L; const map = mapInst.current; if (!L || !map) return
    if (data.routePoints.length > 1) {
      const lls = data.routePoints.map(p => [p.lat, p.lng])
      if (polyline.current) polyline.current.setLatLngs(lls)
      else polyline.current = L.polyline(lls, { color: '#1D9E75', weight: 4 }).addTo(map)
    }
    Object.values(pins.current).forEach(m => map.removeLayer(m))
    pins.current = {}
    data.stops.forEach((st, i) => {
      if (!st.lat || !st.lng) return
      const icon = L.divIcon({ className: '', html: `<div style="width:26px;height:26px;background:#1D9E75;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${i+1}</div>`, iconSize:[26,26], iconAnchor:[13,13] })
      pins.current[st.id] = L.marker([st.lat, st.lng], { icon }).addTo(map)
    })
  }, [data.routePoints, data.stops, screen])

  const toggleGPS = () => {
    if (gpsOn) {
      if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null }
      setGpsOn(false); return
    }
    if (!navigator.geolocation) { setGpsErr('GPS not supported on this device'); return }
    setGpsErr(''); setGpsOn(true)
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        currentPos.current = { lat, lng }
        setData(d => ({ ...d, routePoints: [...d.routePoints, { lat, lng, ts: Date.now() }] }))
        if (mapInst.current) mapInst.current.setView([lat, lng], Math.max(mapInst.current.getZoom(), 15))
      },
      err => { setGpsErr(err.message); setGpsOn(false) },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  const markStop = () => {
    const pos = currentPos.current
    const id = genId()
    setData(d => ({ ...d, stops: [...d.stops, { id, title: '', lat: pos?.lat?.toFixed(6)||'', lng: pos?.lng?.toFixed(6)||'', kind: 'touristAttraction', details: '' }] }))
  }

  const dist = data.routePoints.length > 1 ? data.routePoints.reduce((acc, p, i) => {
    if (!i) return 0; const pr = data.routePoints[i-1], R = 3958.8
    const dl = (p.lat-pr.lat)*Math.PI/180, dg = (p.lng-pr.lng)*Math.PI/180
    const a = Math.sin(dl/2)**2 + Math.cos(pr.lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dg/2)**2
    return acc + R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  }, 0).toFixed(1) : 0

  // Audio
  const toggleAudio = async (stopId) => {
    if (audioRec[stopId]) {
      clearInterval(timerRefs.current[stopId])
      if (audioMr[stopId]?.state !== 'inactive') audioMr[stopId].stop()
      setAudioRec(r => ({ ...r, [stopId]: false }))
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const chunks = []; const mr = new window.MediaRecorder(stream)
        mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        mr.onstop = () => { setAudioUrl(u => ({ ...u, [stopId]: URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' })) })); stream.getTracks().forEach(t => t.stop()) }
        mr.start(500)
        setAudioMr(m => ({ ...m, [stopId]: mr }))
        setAudioRec(r => ({ ...r, [stopId]: true }))
        setAudioDur(d => ({ ...d, [stopId]: 0 }))
        timerRefs.current[stopId] = setInterval(() => setAudioDur(d => ({ ...d, [stopId]: (d[stopId]||0)+1 })), 1000)
      } catch(e) { alert('Mic: ' + e.message) }
    }
  }
  const fmtDur = n => `${Math.floor(n/60)}:${(n%60).toString().padStart(2,'0')}`

  const log = msg => setAiLog(l => [...l, msg])

  // Main AI processing
  const processWithAI = async () => {
    setProcessing(true); setScreen('processing'); setAiLog([])
    try {
      // Build context from stops + audio notes
      const stopContext = data.stops.map((st, i) => `Stop ${i+1}: ${st.title||'unnamed'} ${st.lat?`at ${st.lat},${st.lng}`:''}`).join('; ')

      // Step 1: Research and write each stop
      log('Researching each stop...')
      const enrichedStops = []
      for (let i = 0; i < data.stops.length; i++) {
        const st = data.stops[i]
        log(`Writing stop ${i+1}${st.title ? ': '+st.title : ''}...`)
        try {
          const res = await fetch('/api/claude', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514', max_tokens: 1200,
              tools: [{ type: 'web_search_20250305', name: 'web_search' }],
              system: 'You research and write stop descriptions for Go Trovare, a self-guided travel app. Warm, knowledgeable, second-person voice. 2-3 paragraphs. Include real historical facts, what to look for, practical tips. RETURN ONLY the description text.',
              messages: [{ role: 'user', content: `Write a detailed stop description for: "${st.title||'a notable location'}" ${st.lat?`(coordinates: ${st.lat}, ${st.lng})`:''}.  Search the web for real historical facts and visitor information before writing.` }]
            })
          })
          const d = await res.json()
          const text = d.content?.filter(c=>c.type==='text').map(c=>c.text).join('') || ''
          enrichedStops.push({ ...st, details: text })
        } catch(e) {
          log(`  Error on stop ${i+1}: ${e.message}`)
          enrichedStops.push(st)
        }
      }

      // Step 2: Generate tour title + description from stops
      log('Writing tour overview...')
      const tourRes = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 800,
          system: 'Generate a tour title and description for Go Trovare. Return ONLY valid JSON: {"title":"...","description":"...","tourType":"walk|bike|drive|food|culture|nature","challengeLevel":1-5}',
          messages: [{ role: 'user', content: `Create a tour from these stops: ${stopContext}. Distance: ${dist} miles.` }]
        })
      })
      const tourData = await tourRes.json()
      const tourText = tourData.content?.find(c=>c.type==='text')?.text || '{}'
      let tourInfo = {}
      try { const m = tourText.match(/\{.*\}/s); if (m) tourInfo = JSON.parse(m[0]) } catch {}

      log('Done ✦')
      setData(d => ({
        ...d,
        stops: enrichedStops,
        tourTitle: tourInfo.title || d.tourTitle,
        description: tourInfo.description || '',
        tourType: tourInfo.tourType || d.tourType,
        challengeLevel: tourInfo.challengeLevel || d.challengeLevel,
        distance: dist,
      }))
      setScreen('review')
    } catch(e) {
      log('Error: ' + e.message)
      setTimeout(() => setScreen('audio'), 2000)
    }
    setProcessing(false)
  }

  const publishToSanity = async () => {
    if (!publishToken) return
    setPublishState('publishing')
    const tourId = 'drafts.' + genId()
    const poiDocs = data.stops.map(st => {
      const id = 'drafts.' + genId()
      const doc = { _id: id, _type: 'pointOfInterest', title: st.title, kind: st.kind||'touristAttraction', details: st.details }
      if (st.lat && st.lng) doc.location = { _type: 'geopoint', lat: parseFloat(st.lat), lng: parseFloat(st.lng) }
      return doc
    })
    const tourDoc = {
      _id: tourId, _type: 'tour', title: data.tourTitle, description: data.description,
      tourType: data.tourType, challengeLevel: data.challengeLevel, distance: parseFloat(data.distance)||0,
      pointsOfInterest: poiDocs.map(p => ({ _type: 'reference', _ref: p._id, _key: p._id.slice(-10) }))
    }
    if (data.regionId) tourDoc.relatedRegions = [{ _type: 'reference', _ref: data.regionId, _key: data.regionId.slice(0,8) }]
    try {
      const r = await fetch(`https://${SANITY_PROJECT}.api.sanity.io/${SANITY_VER}/data/mutate/${SANITY_DATASET}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publishToken}` },
        body: JSON.stringify({ mutations: [...poiDocs, tourDoc].map(doc => ({ createOrReplace: doc })) })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error?.description || JSON.stringify(d))
      setPublishState('done')
    } catch(e) { setPublishState('error'); setPublishErr(e.message) }
  }

  const exportNDJSON = () => {
    const tourId = 'drafts.' + genId()
    const pois = data.stops.map(st => {
      const id = 'drafts.' + genId()
      const doc = { _id: id, _type: 'pointOfInterest', title: st.title, kind: st.kind||'touristAttraction', details: st.details }
      if (st.lat && st.lng) doc.location = { _type: 'geopoint', lat: parseFloat(st.lat), lng: parseFloat(st.lng) }
      return doc
    })
    const tour = { _id: tourId, _type: 'tour', title: data.tourTitle, description: data.description, tourType: data.tourType, challengeLevel: data.challengeLevel, pointsOfInterest: pois.map(p=>({_type:'reference',_ref:p._id,_key:p._id.slice(-10)})) }
    const lines = [...pois, tour].map(d => JSON.stringify(d)).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines], {type:'application/x-ndjson'})); a.download = (data.tourTitle||'tour').replace(/\s+/g,'-').toLowerCase()+'.ndjson'; a.click()
  }

  return (
    <div className={s.app}>
      <div className={s.topbar}>
        <div className={s.wordmark}>Go<span>Trovare</span></div>
        {(screen === 'review' || screen === 'publish') && <button className={s.newBtn} onClick={() => { if(confirm('Start a new tour?')) { setData(EMPTY); setScreen('walk') } }}>New tour</button>}
        {screen === 'walk' && data.stops.length > 0 && <button className={s.newBtn} onClick={() => setScreen('audio')}>Next →</button>}
      </div>

      {/* ── WALK SCREEN ── */}
      {screen === 'walk' && (
        <>
          <div className={s.phase}>
            <div className={s.phaseTitle}>Step 1 of 3</div>
            <div className={s.phaseHead}>Record your walk</div>
            <div className={s.phaseSub}>Turn on GPS, walk your route, and tap "Mark stop" at each point of interest.</div>
          </div>

          <div className={s.mapCard}>
            <div className={s.mapEl} ref={mapRef}/>
            <div className={s.mapStats}>
              <div className={s.mapStat}><div className={s.mapStatVal}>{data.routePoints.length}</div><div className={s.mapStatLabel}>GPS pts</div></div>
              <div className={s.mapStat}><div className={s.mapStatVal}>{dist}</div><div className={s.mapStatLabel}>miles</div></div>
              <div className={s.mapStat}><div className={s.mapStatVal}>{data.stops.length}</div><div className={s.mapStatLabel}>stops</div></div>
            </div>
          </div>

          <div className={s.recWrap}>
            <button className={`${s.bigBtn} ${s.bigBtnGPS} ${gpsOn?s.active:''}`} onClick={toggleGPS}>
              <div className={s.bigBtnIcon}>{gpsOn ? '◼' : '●'}</div>
              <div className={s.bigBtnLabel}>{gpsOn ? 'Stop' : 'Record'}</div>
            </button>
            <div className={s.statusPill}>
              <div className={`${s.statusDot} ${gpsOn?'green':''}`}/>
              {gpsOn ? 'Tracking your route...' : 'GPS off'}
            </div>
          </div>

          {gpsErr && <div style={{padding:'0 20px',fontSize:13,color:'#e55'}}>{gpsErr}</div>}

          {gpsOn && (
            <button className={s.markBtn} onClick={markStop}>
              📍 Mark stop here
            </button>
          )}

          {data.stops.length > 0 && (
            <div className={s.stops}>
              {data.stops.map((st, i) => (
                <div key={st.id} className={s.stopPill}>
                  <div className={s.stopNum}>{i+1}</div>
                  <div className={s.stopName}>{st.title || <span style={{color:'#444'}}>Unnamed stop</span>}</div>
                  {st.lat && <div className={s.stopCoord}>{parseFloat(st.lat).toFixed(3)}</div>}
                </div>
              ))}
            </div>
          )}

          {data.stops.length > 0 && (
            <div className={s.actionBar}>
              <button className={s.btnMain} onClick={() => setScreen('audio')}>
                Next: Record audio →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── AUDIO SCREEN ── */}
      {screen === 'audio' && (
        <>
          <div className={s.phase}>
            <div className={s.phaseTitle}>Step 2 of 3</div>
            <div className={s.phaseHead}>Record your story</div>
            <div className={s.phaseSub}>At each stop, hit record and just talk — what is it, what's the history, what should travelers notice? AI will do the rest.</div>
          </div>

          <div className={s.audioStops}>
            {data.stops.map((st, i) => (
              <div key={st.id} className={s.audioStop}>
                <div className={s.audioStopTop}>
                  <div className={s.audioStopNum}>{i+1}</div>
                  <div className={s.audioStopName}>
                    <input
                      value={st.title}
                      onChange={e => setData(d => ({ ...d, stops: d.stops.map(s => s.id===st.id ? {...s,title:e.target.value} : s) }))}
                      placeholder="Name this stop..."
                    />
                  </div>
                  {audioRec[st.id] && <div className={s.recDur}>{fmtDur(audioDur[st.id]||0)}</div>}
                  <button
                    className={`${s.recMini} ${audioRec[st.id]?s.recording:audioUrl[st.id]?s.done:''}`}
                    onClick={() => toggleAudio(st.id)}
                  >
                    {audioRec[st.id] ? '◼' : audioUrl[st.id] ? '✓' : '●'}
                  </button>
                </div>
                {audioUrl[st.id] && <audio src={audioUrl[st.id]} controls className={s.audioPlayerSmall}/>}
              </div>
            ))}
          </div>

          <div className={s.actionBar}>
            <button className={s.btnSec} onClick={() => setScreen('walk')}>← Back</button>
            <button className={s.btnMain} onClick={processWithAI}>
              ✦ Build tour with AI →
            </button>
          </div>
        </>
      )}

      {/* ── PROCESSING SCREEN ── */}
      {screen === 'processing' && (
        <div className={s.aiScreen}>
          <div className={s.aiSpinner}/>
          <div className={s.aiTitle}>Building your tour</div>
          <div className={s.aiSub}>Searching the web and writing descriptions for each stop...</div>
          <div className={s.aiLog}>
            {aiLog.map((line, i) => <div key={i} className={s.aiLogLine}>{line}</div>)}
          </div>
        </div>
      )}

      {/* ── REVIEW SCREEN ── */}
      {screen === 'review' && (
        <>
          <div className={s.phase}>
            <div className={s.phaseTitle}>Step 3 of 3</div>
            <div className={s.phaseHead}>Review & publish</div>
            <div className={s.phaseSub}>AI has filled everything in. Review, edit anything, then publish to Sanity.</div>
          </div>

          <div className={s.resultsScreen}>
            <div className={s.tourCard}>
              <div className={s.editField}>
                <label>Tour title</label>
                <input value={data.tourTitle||''} onChange={e=>setData(d=>({...d,tourTitle:e.target.value}))} placeholder="Tour title..."/>
              </div>
              <div className={s.editField}>
                <label>Description</label>
                <textarea value={data.description||''} onChange={e=>setData(d=>({...d,description:e.target.value}))} rows={4}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div className={s.editField}>
                  <label>Type</label>
                  <select value={data.tourType||'walk'} onChange={e=>setData(d=>({...d,tourType:e.target.value}))}>
                    {['walk','bike','drive','food','culture','nature'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className={s.editField}>
                  <label>Difficulty (1–5)</label>
                  <select value={data.challengeLevel||2} onChange={e=>setData(d=>({...d,challengeLevel:parseInt(e.target.value)}))}>
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className={s.editField}>
                <label>Region</label>
                <select value={data.regionId||''} onChange={e=>{const r=REGIONS.find(r=>r._id===e.target.value);setData(d=>({...d,regionId:e.target.value,regionTitle:r?.title||''}))}}>
                  <option value="">No region</option>
                  {REGIONS.map(r=><option key={r._id} value={r._id}>{r.title}</option>)}
                </select>
              </div>
            </div>

            {data.stops.map((st, i) => (
              <div key={st.id} className={s.stopResult}>
                <div className={s.stopResultNum}>Stop {i+1}</div>
                <div className={s.editField}>
                  <label>Name</label>
                  <input value={st.title} onChange={e=>setData(d=>({...d,stops:d.stops.map(s=>s.id===st.id?{...s,title:e.target.value}:s)}))}/>
                </div>
                <div className={s.editField}>
                  <label>Description</label>
                  <textarea value={st.details||''} onChange={e=>setData(d=>({...d,stops:d.stops.map(s=>s.id===st.id?{...s,details:e.target.value}:s)}))} rows={5}/>
                </div>
                {st.lat && <div className={s.stopResultCoord}>📍 {st.lat}, {st.lng}</div>}
              </div>
            ))}
          </div>

          <div className={s.actionBar}>
            <button className={s.btnSec} onClick={exportNDJSON}>NDJSON ↓</button>
            <button className={s.btnMain} onClick={() => setScreen('publish')}>Publish to Sanity →</button>
          </div>
        </>
      )}

      {/* ── PUBLISH SCREEN ── */}
      {screen === 'publish' && (
        <>
          <div className={s.phase}>
            <div className={s.phaseTitle}>Publish</div>
            <div className={s.phaseHead}>{publishState==='done' ? 'Published!' : 'Send to Sanity'}</div>
            <div className={s.phaseSub}>{publishState==='done' ? 'Your tour is in Sanity as a draft. Open Studio to review and go live.' : 'Enter your Sanity write token to publish directly.'}</div>
          </div>

          {publishState !== 'done' && (
            <div style={{padding:'0 20px'}}>
              <div className={s.editField}>
                <label>Sanity write token</label>
                <input type="password" value={publishToken} onChange={e=>{setPublishToken(e.target.value);localStorage.setItem('trovare_token',e.target.value)}} placeholder="sk..."/>
              </div>
              <div style={{fontSize:12,color:'#555',marginTop:-8,marginBottom:16}}>
                Get one from sanity.io/manage → project 48sx65rc → API → Tokens (Editor role)
              </div>
              {publishErr && <div style={{fontSize:13,color:'#e55',marginBottom:12,fontFamily:'monospace',background:'#1a0000',padding:'10px 12px',borderRadius:8}}>{publishErr}</div>}
            </div>
          )}

          {publishState === 'done' && (
            <div style={{padding:'0 20px'}}>
              <a href="https://trovare-prod.vercel.app/structure" target="_blank" rel="noopener" style={{display:'block',padding:'14px',background:'#1D9E75',borderRadius:12,color:'#fff',textAlign:'center',fontWeight:700,fontSize:15,textDecoration:'none',marginBottom:12}}>
                Open Sanity Studio →
              </a>
            </div>
          )}

          <div className={s.actionBar}>
            {publishState !== 'done' && <button className={s.btnSec} onClick={() => setScreen('review')}>← Back</button>}
            {publishState !== 'done' && (
              <button className={s.btnMain} onClick={publishToSanity} disabled={!publishToken || publishState==='publishing'}>
                {publishState === 'publishing' ? 'Publishing...' : 'Publish now'}
              </button>
            )}
            {publishState === 'done' && (
              <button className={s.btnMain} onClick={() => { setData(EMPTY); setScreen('walk') }}>Start another tour</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}