import React, { useState } from 'react'
import s from './PublishModal.module.css'
export default function PublishModal({ token, publishState, publishError, onPublish, onClose }) {
  const [inputToken, setInputToken] = useState(token || '')
  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalHeader}><h3>Publish to Sanity</h3><button className={s.closeBtn} onClick={onClose}>✕</button></div>
        {publishState === 'success' ? (
          <div className={s.successBlock}>
            <div className={s.successIcon}>✓</div>
            <div className={s.successTitle}>Published!</div>
            <p className={s.successSub}>Your tour has been created as a draft in Sanity. Open Studio to review and publish live.</p>
            <a href="https://trovare-prod.vercel.app/structure" target="_blank" rel="noopener" className={s.studioLink}>Open Sanity Studio →</a>
            <button className={s.btnSecondary} onClick={onClose} style={{marginTop:10}}>Close</button>
          </div>
        ) : publishState === 'error' ? (
          <div className={s.errorBlock}>
            <div className={s.errorTitle}>Publish failed</div>
            <p className={s.errorDetail}>{publishError}</p>
            <button className={s.btnPrimary} onClick={() => onPublish(inputToken)}>Retry</button>
            <button className={s.btnSecondary} onClick={onClose}>Cancel</button>
          </div>
        ) : publishState === 'publishing' ? (
          <div className={s.loadingBlock}><div className={s.spinner}/><div className={s.loadingText}>Publishing...</div></div>
        ) : (
          <>
            <p className={s.modalSub}>Enter a Sanity write token. Your tour and points of interest will be created as drafts.</p>
            <div className={s.tokenField}>
              <label>Sanity write token</label>
              <input type="password" value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="sk..." autoComplete="off"/>
              <p className={s.tokenHint}>Get a token from <a href="https://www.sanity.io/manage/project/48sx65rc/api" target="_blank" rel="noopener">sanity.io/manage → API → Tokens</a> with Editor permissions.</p>
            </div>
            <div className={s.modalActions}>
              <button className={s.btnPrimary} onClick={() => onPublish(inputToken)} disabled={!inputToken}>Publish now</button>
              <button className={s.btnSecondary} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}