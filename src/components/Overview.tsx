import { useApp } from '../store/AppContext'
import type { Project } from '../types'
import { PRIO, projPct, projStatus } from '../lib/helpers'

export default function Overview() {
  const { ui, setUI, wsProjects, openProject, setModal } = useApp()
  const all = wsProjects()
  const projects = ui.search.trim()
    ? all.filter((p) =>
        (p.name + ' ' + (p.client ?? '') + ' ' + (p.domain ?? '')).toLowerCase().includes(ui.search.toLowerCase()),
      )
    : all

  return (
    <div className="ovr">
      <div className="ovr-tools">
        <div className="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            placeholder="Search projects…"
            value={ui.search}
            onChange={(e) => setUI({ search: e.target.value })}
          />
        </div>
        <div className="toggle">
          <button className={ui.view === 'grid' ? 'active' : ''} onClick={() => setUI({ view: 'grid' })}>▦</button>
          <button className={ui.view === 'list' ? 'active' : ''} onClick={() => setUI({ view: 'list' })}>≡</button>
        </div>
        <button className="btn primary" onClick={() => setModal({ type: 'project' })}>
          Add New… <span style={{ opacity: 0.6 }}>▾</span>
        </button>
      </div>

      <div className="ovr-body">
        <div>
          <Sidebar />
        </div>
        <div>
          <div className="slabel">Projects</div>
          {projects.length === 0 ? (
            <div className="scard" style={{ textAlign: 'center', padding: 34 }}>
              <div className="empty" style={{ height: 'auto' }}>
                <div>
                  <div className="big">{ui.search ? 'NO MATCHES' : 'NO PROJECTS YET'}</div>
                  <button className="btn primary" onClick={() => setModal({ type: 'project' })}>Create project</button>
                </div>
              </div>
            </div>
          ) : ui.view === 'list' ? (
            <div className="plist">
              {projects.map((p) => (
                <Row key={p.id} p={p} onOpen={() => openProject(p.id)} onEdit={() => setModal({ type: 'project', id: p.id })} />
              ))}
            </div>
          ) : (
            <div className="pcards">
              {projects.map((p) => (
                <Card key={p.id} p={p} onOpen={() => openProject(p.id)} onEdit={() => setModal({ type: 'project', id: p.id })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Sidebar() {
  const { ui, wsProjects } = useApp()
  const ps = wsProjects()
  const open = ps.reduce((a, p) => a + p.tasks.filter((t) => t.status !== 'done').length, 0)
  const done = ps.reduce((a, p) => a + p.tasks.filter((t) => t.status === 'done').length, 0)
  const feats = ps.reduce((a, p) => a + (p.canvas ? p.canvas.nodes.length : 0), 0)
  const sprints = ps.reduce((a, p) => a + p.sprints.filter((s) => s.status === 'active').length, 0)
  const focus: { tTitle: string; prio: string; pj: string }[] = []
  ps.forEach((p) => p.tasks.filter((t) => t.status === 'in-progress').forEach((t) => focus.push({ tTitle: t.title, prio: t.prio, pj: p.name })))

  return (
    <>
      <div className="slabel">Workspace</div>
      <div className="scard">
        <div className="ttl"><b>{ui.workspace === 'personal' ? 'Personal' : 'Professional'} snapshot</b></div>
        <Srow color="var(--blue)" k="Projects" v={ps.length} />
        <Srow color="var(--med)" k="Open tasks" v={open} />
        <Srow color="var(--grn)" k="Completed" v={done} />
        <Srow color="var(--pur)" k="Features mapped" v={feats} />
        <Srow color="#fff" k="Active sprints" v={sprints} />
      </div>
      <div className="slabel">In focus</div>
      <div className="scard">
        {focus.length ? (
          focus.slice(0, 4).map((f, i) => (
            <div className="focus-item" key={i}>
              <span className="d" style={{ background: PRIO[f.prio as keyof typeof PRIO] }} />
              <span>{f.tTitle}</span>
              <span className="pj">{f.pj}</span>
            </div>
          ))
        ) : (
          <div className="callout"><b>All clear</b><p>Nothing in progress right now.</p></div>
        )}
      </div>
      <div className="slabel">Recent</div>
      <div className="scard">
        <div className="callout">
          <b>{ps.length ? ps[0].name : 'No activity'}</b>
          <p>{ps.length ? 'Last project you touched. Jump back in from the grid.' : 'Create a project to get started.'}</p>
        </div>
      </div>
    </>
  )
}

const Srow = ({ color, k, v }: { color: string; k: string; v: number }) => (
  <div className="srow">
    <span className="k"><span className="kd" style={{ background: color }} />{k}</span>
    <span className="v">{v}</span>
  </div>
)

function Card({ p, onOpen, onEdit }: { p: Project; onOpen: () => void; onEdit: () => void }) {
  const { ui } = useApp()
  const s = projStatus(p)
  const pct = projPct(p)
  const open = p.tasks.filter((t) => t.status !== 'done').length
  const active = p.sprints.find((x) => x.status === 'active')
  const chip = ui.workspace === 'professional' ? p.client || p.domain : active ? active.name.split('·')[0].trim() : null
  return (
    <div className="pcard" onClick={onOpen}>
      <div className="pc-top">
        <div className="pc-icon" style={{ background: p.color }}>{(p.name[0] || '?').toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="pc-name">{p.name}</div>
          <div className="pc-sub">{p.domain || p.desc || ''}</div>
        </div>
        <div className="pc-acts">
          <div className="pc-status" style={{ borderColor: s.c, color: s.c }}>{s.i}</div>
          <button className="pc-dots" onClick={(e) => { e.stopPropagation(); onEdit() }}>⋯</button>
        </div>
      </div>
      {chip && (
        <div className="pc-chip">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#a1a1a1"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
          {chip}
        </div>
      )}
      <div className="pc-foot">
        <span>{open} open · {pct}%</span>
        <span className="pc-bar"><i style={{ width: pct + '%' }} /></span>
      </div>
    </div>
  )
}

function Row({ p, onOpen, onEdit }: { p: Project; onOpen: () => void; onEdit: () => void }) {
  const s = projStatus(p)
  const pct = projPct(p)
  const open = p.tasks.filter((t) => t.status !== 'done').length
  return (
    <div className="prow" onClick={onOpen}>
      <div className="pc-icon" style={{ background: p.color }}>{(p.name[0] || '?').toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pc-name">{p.name}</div>
        <div className="pc-sub">{p.domain || p.client || p.desc || ''}</div>
      </div>
      <span className="pc-foot" style={{ margin: 0 }}>{open} open · {pct}%</span>
      <div className="pc-status" style={{ borderColor: s.c, color: s.c }}>{s.i}</div>
      <button className="pc-dots" onClick={(e) => { e.stopPropagation(); onEdit() }}>⋯</button>
    </div>
  )
}
