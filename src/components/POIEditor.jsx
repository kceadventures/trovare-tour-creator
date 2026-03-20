import React from 'react'
import s from './POIEditor.module.css'
const KINDS = ['touristAttraction','restaurant','cafeRestaurant','shop','viewpoint','museum','park','historic','hotel','other']
export default function POIEditor({ poi, index, total, onUpdate, onRemove, onMoveUp, onMoveDown, onToggle, onGenerateAI, aiLoading, aiStatus }) {
  return (
    <div className={s.card}>
      <div className={s.header}>
        <div className={s.num}>{index + 1}</div>
        <div className={s.titleArea}>
          <span className={s.title}>{poi.title || 'Untitled stop'}</span>
          {poi.kind && <span className={s.kindBadge}>{poi.kind}</span>}
        </div>
        <div className={s.actions}>
          {index > 0 && <button className={s.iconBtn} onClick={onMoveUp}>↑</button>}
          {index < total - 1 && <button className={s.iconBtn} onClick={onMoveDown}>↓</button>}
          <button className={s.iconBtn} onClick={onToggle}>{poi.expanded ? '▲' : '▼'}</button>
          <button className={`${s.iconBtn} ${s.removeBtn}`} onClick={onRemove}>✕</button>
        </div>
      </div>
      {poi.expanded && (
        <div className={s.body}>
          <div className={s.row2}>
            <div className={s.field}><label>Name *</label><input type="text" value={poi.title} onChange={e => onUpdate('title', e.target.value)} placeholder="e.g. Balbi's Arch" /></div>
            <div className={s.field}><label>Category</label><select value={poi.kind} onChange={e => onUpdate('kind', e.target.value)}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
          </div>
          <div className={s.row2}>
            <div className={s.field}><label>Latitude</label><input type="text" value={poi.lat} onChange={e => onUpdate('lat', e.target.value)} placeholder="e.g. 45.0821" /></div>
            <div className={s.field}><label>Longitude</label><input type="text" value={poi.lng} onChange={e => onUpdate('lng', e.target.value)} placeholder="e.g. 13.6342" /></div>
          </div>
          <div className={s.field}>
            <label>Details / description</label>
            <textarea value={poi.details} onChange={e => onUpdate('details', e.target.value)} placeholder="What will travelers see, learn, or do here?" rows={4} />
            <button className={`${s.aiBtn} ${aiLoading ? s.aiBtnLoading : ''}`} onClick={onGenerateAI} disabled={aiLoading || !poi.title}>✦ {aiLoading ? 'Writing...' : 'Generate details with AI'}</button>
            {aiStatus && <div className={s.aiStatus}>{aiStatus}</div>}
          </div>
          <div className={s.mediaSection}>
            <div className={s.mediaTitle}>Media</div>
            <div className={s.row3}>
              <div className={s.field}><label>Image URL</label><input type="text" value={poi.imageUrl||''} onChange={e => onUpdate('imageUrl', e.target.value)} placeholder="https://..." /></div>
              <div className={s.field}><label>Audio (Supabase path)</label><input type="text" value={poi.audioUrl||''} onChange={e => onUpdate('audioUrl', e.target.value)} placeholder="media/audios/file.mp3" /></div>
              <div className={s.field}><label>Video (Supabase path)</label><input type="text" value={poi.videoUrl||''} onChange={e => onUpdate('videoUrl', e.target.value)} placeholder="media/videos/file.mp4" /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}