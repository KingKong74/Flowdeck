import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { PRIO } from '../lib/helpers'

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function CalendarPanel({ onClose }: { onClose: () => void }) {
  const { data, setWorkspace, openProject } = useApp()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sel, setSel] = useState<string | null>(fmt(today))

  // map of dueDate -> tasks (across all projects/workspaces)
  const due = useMemo(() => {
    const m: Record<string, { title: string; prio: string; pid: string; ws: 'personal' | 'professional' }[]> = {}
    data.projects.forEach((p) =>
      p.tasks.forEach((t) => {
        if (t.due) (m[t.due] ??= []).push({ title: t.title, prio: t.prio, pid: p.id, ws: p.workspace })
      }),
    )
    return m
  }, [data])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthName = cursor.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  const selItems = sel ? due[sel] ?? [] : []

  const jump = (ws: 'personal' | 'professional', pid: string) => {
    setWorkspace(ws)
    openProject(pid)
    onClose()
  }

  return (
    <div className="cal" onClick={(e) => e.stopPropagation()}>
      <div className="cal-head">
        <b>{monthName}</b>
        <div className="cal-nav">
          <button className="ico" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
          <button className="ico" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
        </div>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => (
          <div className="cal-dow" key={d}>{d}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const key = fmt(c)
          const isToday = key === fmt(today)
          return (
            <div
              key={i}
              className={'cal-day' + (isToday ? ' today' : '') + (key === sel ? ' sel' : '')}
              onClick={() => setSel(key)}
            >
              {c.getDate()}
              {due[key] && <span className="cal-dot" />}
            </div>
          )
        })}
      </div>
      <div className="cal-list">
        {selItems.length ? (
          selItems.map((it, i) => (
            <div className="cal-item" key={i} onClick={() => jump(it.ws, it.pid)}>
              <span className="d" style={{ background: PRIO[it.prio as keyof typeof PRIO] }} />
              <span>{it.title}</span>
              <span className="pj">{it.ws === 'professional' ? 'work' : 'personal'}</span>
            </div>
          ))
        ) : (
          <div className="cal-empty">{sel ? 'Nothing due this day' : 'Pick a day'}</div>
        )}
      </div>
    </div>
  )
}
