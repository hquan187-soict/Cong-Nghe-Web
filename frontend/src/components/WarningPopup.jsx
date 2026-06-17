import { useState, useEffect } from 'react'
import { useLang } from '../context/LangContext'

const STORAGE_KEY = 'show_warning_popup'

export function triggerWarningPopup() {
  localStorage.setItem(STORAGE_KEY, 'true')
}

function WarningPopup() {
  const { t } = useLang()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      setShow(true)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 420, width: '100%',
        padding: '32px 28px', textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#fef3c7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
          {t('warning.title')}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.6, color: '#475569' }}>
          {t('warning.message')}
        </p>
        <button
          onClick={() => setShow(false)}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: '#4f46e5', color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', width: '100%',
          }}
        >
          {t('warning.understood')}
        </button>
      </div>
    </div>
  )
}

export default WarningPopup
