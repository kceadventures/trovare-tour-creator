import React, { useState, useEffect } from 'react'
import styles from './App.module.css'
import FieldRecorder from './components/FieldRecorder.jsx'
import PublishModal from './components/PublishModal.jsx'

const SANITY_PROJECT_ID = '48sx65rc'
const SANITY_DATASET = 'production'
const SANITY_API_VERSION = 'v2022-03-07'
const TOUR_TYPES = ['walk','bike','drive','food','culture','nature']
const TOUR_TYPE_LABELS = {walk:'Walking',bike:'Cycling',drive:'Driving',food:'Food & Drink',culture:'Culture',nature:'Nature'}
const CHALLENGE_LABELS = ['','Easy','Moderate','Challenging','Strenuous','Expert']
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
const EMPTY = {title:'',description:'',tourType:'walk',challengeLevel:1,distance:'',duration:'',regionId:'',regionTitle:'',newRegion:false,newRegionDesc:'',creatorName:'',pois:[],routePoints:[]}
const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36)

export default function App() {
  const [step, setStep] = useState(1)
  const [tour, setTour] = useState(() => { try { const s = localStorage.getItem('trovare_draft'); return s ? JSON.parse(s) : EMPTY } catch { return EMPTY } })
  const [showPublish, setShowPublish] = useState(false)
  const [aiLoading, setAiLoading] = useState({})
  const [aiStatus, setAiStatus] = useState({})
  const [sanityToken] = useState(() => localStorage.getItem('trovare_token')||'')
  const [publishState, setPublishState] = useState(null)
  const [publishError, setPublishError] = useState('')

  useEffect(() => { localStorage.setItem('trovare_draft', JSON.stringify(tour)) }, [tour])
  const setField = (f,v) => setTour(t => ({...t,[f]:v}))

  const callClaude = async (prompt, system) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system,messages:[{role:'user',content:prompt}]})
    })
    const data = await res.json()
    return data.content?.find(c=>c.type==='text')?.text||''
  }

  const generateTourDesc = async () => {
    if (!tour.title) return
    setAiLoading(l=>({...l,desc:true})); setAiStatus(s=>({...s,desc:'Writing...'}))
    try {
      const text = await callClaude(
        `Tour: "${tour.title}" in ${tour.regionTitle||'an interesting destination'}. Type: ${TOUR_TYPE_LABELS[tour.tourType]}. Difficulty: ${tour.challengeLevel}/5. Stops: ${tour.pois.map(p=>p.title).filter(Boolean).join(', ')||'various'}.`,
        'Write a compelling self-guided tour description for the Go Trovare travel app. Active, curious travelers. 2-3 engaging paragraphs, second person, warm tone. No headers or bullets. Return only the description.'
      )
      setField('description',text); setAiStatus(s=>({...s,desc:'✦ Generated'}))
    } catch { setAiStatus(s=>({...s,desc:'Error — check connection'})) }
    setAiLoading(l=>({...l,desc:false}))
  }

  const buildDocs = () => {
    const tourId = 'drafts.'+genId()
    const poiDocs = tour.pois.map(p => {
      const id = 'drafts.'+genId()
      const doc = {_id:id,_type:'pointOfInterest',title:p.title,kind:p.kind,details:p.details}
      if (p.lat&&p.lng) doc.location={_type:'geopoint',lat:parseFloat(p.lat),lng:parseFloat(p.lng)}
      if (p.audioUrl) doc.audioUpload={_type:'supabase.asset',assetKey:p.audioUrl,fileType:'audio/mpeg',fileExtension:'mp3',filename:p.audioUrl.split('/').pop()||'audio.mp3'}
      return doc
    })
    const tourDoc = {_id:tourId,_type:'tour',title:tour.title,description:tour.description,tourType:tour.tourType,challengeLevel:tour.challengeLevel,distance:parseFloat(tour.distance)||0,durationRange:tour.duration?[parseFloat(tour.duration)]:[],pointsOfInterest:poiDocs.map(p=>({_type:'reference',_ref:p._id,_key:p._id.replace('drafts.','').slice(0,12)}))}
    if (tour.regionId&&!tour.newRegion) tourDoc.relatedRegions=[{_type:'reference',_ref:tour.regionId,_key:tour.regionId.slice(0,8)}]
    const docs = [...poiDocs,tourDoc]
    if (tour.newRegion&&tour.regionTitle) {
      const regId='drafts.'+genId()
      docs.unshift({_id:regId,_type:'region',title:tour.regionTitle,description:tour.newRegionDesc})
      tourDoc.relatedRegions=[{_type:'reference',_ref:regId,_key:regId.replace('drafts.','').slice(0,8)}]
    }
    return docs
  }

  const publishToSanity = async (token) => {
    setPublishState('publishing'); localStorage.setItem('trovare_token',token)
    const mutations = buildDocs().map(doc=>({createOrReplace:doc}))
    try {
      const res = await fetch(`https://${SANITY_PROJECT_ID}.api.sanity.io/${SANITY_API_VERSION}/data/mutate/${SANITY_DATASET}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({mutations})})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.description||JSON.stringify(data))
      setPublishState('success')
    } catch(e) { setPublishState('error'); setPublishError(e.message) }
  }

  const exportNDJSON = () => {
    const lines = buildDocs().map(d=>JSON.stringify(d)).join('\n')
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([lines],{type:'application/x-ndjson'})); a.download=(tour.title||'tour').replace(/\s+/g,'-').toLowerCase()+'.ndjson'; a.click()
  }

  const CHALLENGE_LABELS_ARR = ['','Easy','Moderate','Challenging','Strenuous','Expert']

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}><span className={styles.logoGo}>Go</span><span className={styles.logoTrovare}> Trovare</span><span className={styles.logoSub}>Tour Creator</span></div>
          <div className={styles.headerActions}>
            {tour.title && <span className={styles.draftBadge}>● Draft saved</span>}
            <button className={styles.btnGhost} onClick={() => { if(confirm('Clear and start fresh?')) { setTour(EMPTY); setStep(1) } }}>New tour</button>
          </div>
        </div>
      </header>

      <div className={styles.stepper}>
        {[{n:1,label:'Tour info'},{n:2,label:'Stops & route'},{n:3,label:'Review & publish'}].map(({n,label}) => (
          <button key={n} className={`${styles.stepBtn} ${step===n?styles.stepActive:''} ${step>n?styles.stepDone:''}`} onClick={()=>setStep(n)}>
            <span className={styles.stepNum}>{step>n?'✓':n}</span><span className={styles.stepLabel}>{label}</span>
          </button>
        ))}
      </div>

      <main className={styles.main}>
        {step===1 && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Tour info</h2>
            <p className={styles.panelSub}>Basic details — you can fill this in before or after recording your route</p>
            <div className={styles.field}><label>Tour title *</label><input type="text" value={tour.title} onChange={e=>setField('title',e.target.value)} placeholder="e.g. Hidden Litchfield Hills: Farm Stands & River Roads"/></div>
            <div className={styles.field}>
              <label>Description</label>
              <textarea value={tour.description} onChange={e=>setField('description',e.target.value)} placeholder="What will travelers experience? AI can write this once you've added stops." rows={5}/>
              <button className={`${styles.aiBtn} ${aiLoading.desc?styles.aiBtnLoading:''}`} onClick={generateTourDesc} disabled={aiLoading.desc||!tour.title}>
                ✦ {aiLoading.desc?'Writing...':'Generate description from stops'}
              </button>
              {aiStatus.desc && <div className={styles.aiStatus}>{aiStatus.desc}</div>}
            </div>
            <div className={styles.field}><label>Tour type</label><div className={styles.chipRow}>{TOUR_TYPES.map(t=><button key={t} className={`${styles.chip} ${tour.tourType===t?styles.chipActive:''}`} onClick={()=>setField('tourType',t)}>{TOUR_TYPE_LABELS[t]}</button>)}</div></div>
            <div className={styles.fieldRow3}>
              <div className={styles.field}><label>Distance (miles)</label><input type="number" value={tour.distance} onChange={e=>setField('distance',e.target.value)} placeholder="e.g. 2.5" step="0.1" min="0"/></div>
              <div className={styles.field}><label>Duration (hours)</label><input type="number" value={tour.duration} onChange={e=>setField('duration',e.target.value)} placeholder="e.g. 1.5" step="0.5" min="0"/></div>
              <div className={styles.field}><label>Creator name</label><input type="text" value={tour.creatorName} onChange={e=>setField('creatorName',e.target.value)} placeholder="e.g. Collin Jarvis"/></div>
            </div>
            <div className={styles.field}><label>Difficulty</label><div className={styles.diffRow}>{[1,2,3,4,5].map(n=><button key={n} className={`${styles.diffBtn} ${tour.challengeLevel===n?styles.diffActive:''}`} onClick={()=>setField('challengeLevel',n)}>{n} — {CHALLENGE_LABELS_ARR[n]}</button>)}</div></div>
            <div className={styles.field}>
              <label>Region</label>
              <select value={tour.newRegion?'__new__':tour.regionId} onChange={e=>{if(e.target.value==='__new__'){setTour(t=>({...t,newRegion:true,regionId:'',regionTitle:''}))}else{const r=REGIONS.find(r=>r._id===e.target.value);setTour(t=>({...t,newRegion:false,regionId:e.target.value,regionTitle:r?.title||''}))}}}>
                <option value="">Select a region...</option>
                {REGIONS.map(r=><option key={r._id} value={r._id}>{r.title}</option>)}
                <option value="__new__">+ Create new region</option>
              </select>
              {tour.newRegion && <div className={styles.newRegionBlock}><input type="text" value={tour.regionTitle} onChange={e=>setField('regionTitle',e.target.value)} placeholder="Region name (e.g. Litchfield Hills, CT)"/><textarea value={tour.newRegionDesc} onChange={e=>setField('newRegionDesc',e.target.value)} placeholder="Region description (optional)" rows={3}/></div>}
            </div>
            <div className={styles.navRow}><span/><button className={styles.btnPrimary} onClick={()=>setStep(2)}>Next: Add stops & record route →</button></div>
          </div>
        )}

        {step===2 && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Stops & route</h2>
            <p className={styles.panelSub}>Go out and record — or build stops from a list. AI fills in the details.</p>
            <FieldRecorder
              stops={tour.pois}
              routePoints={tour.routePoints}
              onStopsUpdate={fn => setTour(t => ({...t, pois: typeof fn === 'function' ? fn(t.pois) : fn}))}
              onRouteUpdate={fn => setTour(t => ({...t, routePoints: typeof fn === 'function' ? fn(t.routePoints) : fn}))}
            />
            <div className={styles.navRow}><button className={styles.btnSecondary} onClick={()=>setStep(1)}>← Back</button><button className={styles.btnPrimary} onClick={()=>setStep(3)}>Next: Review & publish →</button></div>
          </div>
        )}

        {step===3 && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Review & publish</h2>
            <p className={styles.panelSub}>Everything look good? Send it to Sanity as a draft.</p>
            <div className={styles.summaryGrid}>
              {[['Title',tour.title||'—'],['Type',TOUR_TYPE_LABELS[tour.tourType]],['Distance',(tour.distance||'—')+' mi'],['Duration',(tour.duration||'—')+' hr'],['Difficulty',tour.challengeLevel+' — '+CHALLENGE_LABELS_ARR[tour.challengeLevel]],['Stops',tour.pois.length],['Region',tour.regionTitle||'—'],['Route pts',tour.routePoints.length]].map(([l,v])=>(
                <div key={l} className={styles.summaryCard}><div className={styles.summaryLabel}>{l}</div><div className={styles.summaryValue}>{v}</div></div>
              ))}
            </div>
            {tour.description && <div className={styles.descPreview}><div className={styles.summaryLabel} style={{marginBottom:6}}>Description</div><p>{tour.description}</p></div>}
            {tour.pois.length>0 && <div className={styles.poisPreview}><div className={styles.summaryLabel} style={{marginBottom:8}}>Stops</div>{tour.pois.map(p=><div key={p.id} className={styles.poiPreviewItem}><span className={styles.poiPreviewDot}/><span className={styles.poiPreviewName}>{p.title||'Untitled'}</span><span className={styles.poiPreviewMeta}> · {p.kind}</span>{p.audioUrl&&<span className={styles.mediaBadge}>🎙</span>}{p.lat&&<span className={styles.coordBadge}>{parseFloat(p.lat).toFixed(4)}, {parseFloat(p.lng).toFixed(4)}</span>}</div>)}</div>}
            <div className={styles.publishActions}>
              <button className={styles.btnPrimary} onClick={()=>setShowPublish(true)}>Publish to Sanity →</button>
              <button className={styles.btnSecondary} onClick={exportNDJSON}>Export NDJSON</button>
            </div>
            <div className={styles.navRow}><button className={styles.btnSecondary} onClick={()=>setStep(2)}>← Back</button><span/></div>
          </div>
        )}
      </main>
      {showPublish && <PublishModal token={sanityToken} publishState={publishState} publishError={publishError} onPublish={publishToSanity} onClose={()=>{setShowPublish(false);setPublishState(null)}}/>}
    </div>
  )
}