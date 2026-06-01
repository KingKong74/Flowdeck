import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'

export default function TopBar() {
  const { ui, setUI, setWorkspace } = useApp()
  const [menu, setMenu] = useState(false)
  const [now, setNow] = useState(new Date())
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(false)
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
        <svg width="20" height="18" viewBox="0 0 22 20">
          <path d="M11 0 22 20 0 20Z" fill="#fff" />
        </svg>
        <b>Flowdeck</b>
      </div>
      <span className="slash">/</span>
      <div className="wswrap" ref={wrap}>
        <button
          className="ws"
          onClick={(e) => {
            e.stopPropagation()
            setMenu((m) => !m)
          }}
        >
          <span className="wsdot" style={{ background: ui.workspace === 'personal' ? 'var(--blue)' : 'var(--pur)' }} />
          <span>{ui.workspace === 'personal' ? 'Personal' : 'Professional'}</span>
          <span className="chev">▼</span>
        </button>
        {menu && (
          <div className="wsmenu">
            <button onClick={() => { setWorkspace('personal'); setMenu(false) }}>
              <span className="wsdot" style={{ background: 'var(--blue)' }} />
              Personal<span className="ws-sub">your projects</span>
            </button>
            <button onClick={() => { setWorkspace('professional'); setMenu(false) }}>
              <span className="wsdot" style={{ background: 'var(--pur)' }} />
              Professional<span className="ws-sub">client work</span>
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
      <div className="clock">{clock}</div>
    </div>
  )
}
