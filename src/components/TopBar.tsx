import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import CalendarPanel from './CalendarPanel'

export default function TopBar() {
  const { ui, setUI, setWorkspace, authEnabled, userEmail, signOut } = useApp()
  const [menu, setMenu] = useState(false)
  const [cal, setCal] = useState(false)
  const [now, setNow] = useState(new Date())
  const wrap = useRef<HTMLDivElement>(null)
  const calWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(false)
      if (calWrap.current && !calWrap.current.contains(e.target as Node)) setCal(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  const clock =
    now.toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' · ' +
    now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="topbar">
      <div className="logo">
        <svg width="20" height="18" viewBox="0 0 22 20"><path d="M11 0 22 20 0 20Z" /></svg>
        <b>Flowdeck</b>
      </div>
      <span className="slash">/</span>
      <div className="wswrap" ref={wrap}>
        <button className="ws" onClick={(e) => { e.stopPropagation(); setMenu((m) => !m) }}>
          <span className="wsdot" style={{ background: ui.workspace === 'personal' ? 'var(--blue)' : 'var(--pur)' }} />
          <span>{ui.workspace === 'personal' ? 'Personal' : 'Professional'}</span>
          <span className="chev">▼</span>
        </button>
        {menu && (
          <div className="wsmenu">
            <button onClick={() => { setWorkspace('personal'); setMenu(false) }}>
              <span className="wsdot" style={{ background: 'var(--blue)' }} />Personal<span className="ws-sub">your projects</span>
            </button>
            <button onClick={() => { setWorkspace('professional'); setMenu(false) }}>
              <span className="wsdot" style={{ background: 'var(--pur)' }} />Professional<span className="ws-sub">client work</span>
            </button>
          </div>
        )}
      </div>
      <div className="nav">
        <button
          className={'mode' + (ui.mode === 'overview' || ui.mode === 'project' ? ' active' : '')}
          onClick={() => setUI({ mode: 'overview', activeProjectId: null })}
        >
          Overview
        </button>
        {ui.workspace === 'personal' && (
          <button className={'mode' + (ui.mode === 'backlog' ? ' active' : '')} onClick={() => setUI({ mode: 'backlog' })}>
            Backlog
          </button>
        )}
      </div>
      <div className="spacer" />

      <div className="calwrap" ref={calWrap}>
        <button className="ico" title="Calendar" onClick={(e) => { e.stopPropagation(); setCal((c) => !c) }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
        </button>
        {cal && <CalendarPanel onClose={() => setCal(false)} />}
      </div>
      <div className="clock">{clock}</div>
      <button
        className={'ico' + (ui.mode === 'settings' ? ' on' : '')}
        title="Settings"
        onClick={() => setUI({ mode: 'settings' })}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {authEnabled && (
        <div className="account">
          {userEmail && <span className="em">{userEmail}</span>}
          <button className="btn ghost sm" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}
