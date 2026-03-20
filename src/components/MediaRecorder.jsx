import React, { useState, useRef, useEffect } from 'react'
import s from './MediaRecorder.module.css'
export default function MediaRecorderComponent({ pois, onPoiAudio, onPoiVideo }) {
  const [mode, setMode] = useState('audio')
  const [recording, setRecording] = useState(false)
  const [mediaBlobUrl, setMediaBlobUrl] = useState(null)
  const [selectedPoi, setSelectedPoi] = useState('')
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [supabasePath, setSupabasePath] = useState('')
  const [assigned, setAssigned] = useState(false)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  useEffect(() => () => { stopStream(); clearInterval(timerRef.current) }, [])
  const stopStream = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null } }
  const startRecording = async () => {
    setError(''); setMediaBlobUrl(null); setAssigned(false); chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mode === 'video' ? { audio: true, video: { facingMode: 'environment' } } : { audio: true })
      streamRef.current = stream
      if (mode === 'video' && videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; videoPreviewRef.current.play() }
      const mr = new window.MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { const blob = new Blob(chunksRef.current, { type: mode === 'video' ? 'video/webm' : 'audio/webm' }); setMediaBlobUrl(URL.createObjectURL(blob)); stopStream() }
      mr.start(1000); setRecording(true); setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch(e) { setError('Could not access ' + (mode==='video'?'camera/mic':'microphone') + ': ' + e.message) }
  }
  const stopRecording = () => { clearInterval(timerRef.current); if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop(); setRecording(false) }
  const assignToPOI = () => { if (!selectedPoi || !supabasePath) return; mode === 'audio' ? onPoiAudio(selectedPoi, supabasePath) : onPoiVideo(selectedPoi, supabasePath); setAssigned(true) }
  const fmtDur = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  return (
    <div className={s.container}>
      <div className={s.header}><h3 className={s.title}>Audio & Video Recording</h3><p className={s.sub}>Record narration at stops — download, upload to Supabase, then paste the path</p></div>
      <div className={s.modeRow}>
        <button className={`${s.modeBtn} ${mode==='audio'?s.modeBtnActive:''}`} onClick={() => { setMode('audio'); setMediaBlobUrl(null) }} disabled={recording}>🎙 Audio narration</button>
        <button className={`${s.modeBtn} ${mode==='video'?s.modeBtnActive:''}`} onClick={() => { setMode('video'); setMediaBlobUrl(null) }} disabled={recording}>📹 Video clip</button>
      </div>
      {mode === 'video' && <div className={s.videoWrap}><video ref={videoPreviewRef} className={s.videoPreview} muted playsInline style={{display:recording?'block':'none'}}/>{!recording && !mediaBlobUrl && <div className={s.videoPlaceholder}>Camera preview appears here</div>}{!recording && mediaBlobUrl && <video src={mediaBlobUrl} controls className={s.videoPreview}/>}</div>}
      {mode === 'audio' && mediaBlobUrl && !recording && <audio src={mediaBlobUrl} controls className={s.audioPlayer}/>}
      {error && <div className={s.error}>{error}</div>}
      <div className={s.controls}>
        {!recording ? <button className={s.btnRecord} onClick={startRecording}>● Start {mode} recording</button> : <div className={s.recordingRow}><div className={s.recordingIndicator}><span className={s.redDot}/><span>Recording {fmtDur(duration)}</span></div><button className={s.btnStop} onClick={stopRecording}>■ Stop</button></div>}
        {mediaBlobUrl && <button className={s.btnSecondary} onClick={() => { const a = document.createElement('a'); a.href=mediaBlobUrl; a.download=`trovare-${mode}-${Date.now()}.webm`; a.click() }}>↓ Download</button>}
      </div>
      {mediaBlobUrl && <div className={s.assignBlock}>
        <div className={s.assignTitle}>After uploading to Supabase, assign to a stop:</div>
        <div className={s.assignRow}>
          <select value={selectedPoi} onChange={e => setSelectedPoi(e.target.value)} className={s.poiSelect}><option value="">Select a stop...</option>{pois.map(p => <option key={p.id} value={p.id}>{p.title||'Untitled'}</option>)}</select>
          <input type="text" value={supabasePath} onChange={e => setSupabasePath(e.target.value)} placeholder={`media/${mode}s/file`} className={s.pathInput}/>
          <button className={s.assignBtn} onClick={assignToPOI} disabled={!selectedPoi||!supabasePath}>{assigned?'✓ Assigned':'Assign'}</button>
        </div>
        {assigned && <div className={s.assignedMsg}>✦ Path saved to stop</div>}
      </div>}
    </div>
  )
}