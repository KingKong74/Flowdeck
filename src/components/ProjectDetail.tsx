import { useApp } from '../store/AppContext'
import Board from './Board'
import FlowMap from './FlowMap'

export default function ProjectDetail() {
  const { ui, setUI, wsProjects, activeProject, openProject, goOverview, setModal, mutate } = useApp()
  const p = activeProject()
  if (!p) {
    goOverview()
    return null
  }

  const del = () => {
    if (!confirm('Delete this project and everything in it?')) return
    mutate((d) => {
      d.projects = d.projects.filter((x) => x.id !== p.id)
    })
    goOverview()
  }

  return (
    <>
      <div className="rail">
        <div className="rail-head">
          <span className="l">{ui.workspace}</span>
          <button className="ico" onClick={() => setModal({ type: 'project' })}>+</button>
        </div>
        <div className="rail-list">
          <div className="back" onClick={goOverview}>
            <span style={{ fontFamily: 'var(--mono)' }}>←</span>
            <span>Overview</span>
          </div>
          {wsProjects().map((pr) => {
            const open = pr.tasks.filter((t) => t.status !== 'done').length
            return (
              <div key={pr.id} className={'pitem' + (pr.id === p.id ? ' active' : '')} onClick={() => openProject(pr.id)}>
                <span className="pdot" style={{ background: pr.color }} />
                <span className="nm">{pr.name}</span>
                <span className="ct">{open}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="main">
        <div className="phead">
          <div>
            <button className="crumb" onClick={goOverview}>
              {ui.workspace === 'personal' ? 'Personal' : 'Professional'} / Overview
            </button>
            <h2>{p.name}</h2>
            <p>{p.client ? 'Client · ' + p.client : p.desc || ''}</p>
          </div>
          <div className="acts">
            <button className="btn ghost sm" onClick={() => setModal({ type: 'project', id: p.id })}>Edit</button>
            <button className="btn ghost sm danger" onClick={del}>Delete</button>
          </div>
        </div>
        <div className="ptabs">
          <button className={'ptab' + (ui.projectTab === 'board' ? ' active' : '')} onClick={() => setUI({ projectTab: 'board' })}>Board</button>
          <button className={'ptab' + (ui.projectTab === 'map' ? ' active' : '')} onClick={() => setUI({ projectTab: 'map' })}>Map</button>
        </div>
        {ui.projectTab === 'board' ? <Board project={p} /> : <FlowMap key={p.id} project={p} />}
      </div>
    </>
  )
}
