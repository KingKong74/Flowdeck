import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useApp } from '../store/AppContext'
import type { Project, Task, Status } from '../types'
import { COLS, PRIO, taskPct } from '../lib/helpers'

export default function Board({ project }: { project: Project }) {
  const { ui, setUI, mutate, setModal } = useApp()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tasks = project.tasks.filter((t) =>
    ui.activeSprint === 'all' ? true : ui.activeSprint === 'backlog' ? !t.sprintId : t.sprintId === ui.activeSprint,
  )

  const counts: Record<string, number> = {}
  COLS.forEach((c) => (counts[c.id] = 0))
  tasks.forEach((t) => counts[t.status]++)
  const overall = tasks.length ? Math.round(tasks.reduce((a, t) => a + taskPct(t), 0) / tasks.length) : 0

  const onDragEnd = (e: DragEndEvent) => {
    const col = e.over?.id as Status | undefined
    const id = e.active.id as string
    if (!col) return
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === project.id)!
      const t = pr.tasks.find((x) => x.id === id)
      if (t) t.status = col
    })
  }

  const bl = project.tasks.filter((t) => !t.sprintId).length

  return (
    <div className="scroll">
      <div className="sprintbar">
        <button className={'chip' + (ui.activeSprint === 'all' ? ' active' : '')} onClick={() => setUI({ activeSprint: 'all' })}>
          ALL <span className="b">{project.tasks.length}</span>
        </button>
        {project.sprints.map((s) => (
          <button
            key={s.id}
            className={'chip' + (s.status === 'active' ? ' live' : '') + (ui.activeSprint === s.id ? ' active' : '')}
            onClick={() => setUI({ activeSprint: s.id })}
          >
            {s.name} <span className="b">{project.tasks.filter((t) => t.sprintId === s.id).length}</span>
          </button>
        ))}
        <button className={'chip' + (ui.activeSprint === 'backlog' ? ' active' : '')} onClick={() => setUI({ activeSprint: 'backlog' })}>
          UNASSIGNED <span className="b">{bl}</span>
        </button>
        <button className="chip" style={{ borderStyle: 'dashed' }} onClick={() => setModal({ type: 'sprint' })}>+ SPRINT</button>
      </div>

      <div className="pipe">
        {COLS.map((c) => (
          <div className="pstage" key={c.id}>
            <div className="n" style={{ color: c.t }}>{counts[c.id]}</div>
            <div className="l">{c.nm}</div>
          </div>
        ))}
        <div className="pover">
          <div className="l">Progress</div>
          <div className="pct">{overall}%</div>
          <div className="bar"><i style={{ width: overall + '%' }} /></div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board">
          {COLS.map((c) => (
            <Column key={c.id} id={c.id} nm={c.nm} tone={c.t} project={project} tasks={tasks.filter((t) => t.status === c.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function Column({ id, nm, tone, project, tasks }: { id: Status; nm: string; tone: string; project: Project; tasks: Task[] }) {
  const { setModal } = useApp()
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={'col' + (isOver ? ' drop' : '')}>
      <div className="chead">
        <span className="t" style={{ background: tone }} />
        <span className="nm">{nm}</span>
        <span className="ct">{tasks.length}</span>
      </div>
      <div className="cbody">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} project={project} />
        ))}
        <button className="addcard" onClick={() => setModal({ type: 'task', status: id })}>+ Add task</button>
      </div>
    </div>
  )
}

function TaskCard({ task, project }: { task: Task; project: Project }) {
  const { ui, toggleCard, mutate, setModal } = useApp()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const [draft, setDraft] = useState('')
  const subs = task.subs || []
  const done = subs.filter((s) => s.d).length
  const sprint = task.sprintId ? project.sprints.find((s) => s.id === task.sprintId) : null
  const isOpen = ui.openCards.includes(task.id)

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  const updateTask = (fn: (t: Task) => void) =>
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === project.id)!
      const t = pr.tasks.find((x) => x.id === task.id)
      if (t) fn(t)
    })

  const addSub = () => {
    const v = draft.trim()
    if (!v) return
    updateTask((t) => t.subs.push({ id: Math.random().toString(36).slice(2, 9), t: v, d: false }))
    setDraft('')
  }
  const toggleSub = (sid: string) =>
    updateTask((t) => {
      const s = t.subs.find((x) => x.id === sid)!
      s.d = !s.d
      if (t.subs.length && t.subs.every((x) => x.d)) t.status = 'done'
    })
  const delSub = (sid: string) => updateTask((t) => (t.subs = t.subs.filter((x) => x.id !== sid)))
  const delTask = () =>
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === project.id)!
      pr.tasks = pr.tasks.filter((x) => x.id !== task.id)
    })

  return (
    <div
      ref={setNodeRef}
      className={'card' + (isDragging ? ' dragging' : '')}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="ctop">
        <span className="prio" style={{ background: PRIO[task.prio] }} />
        <span className="ctitle">{task.title}</span>
      </div>
      {subs.length > 0 && (
        <div className="segs">
          {subs.map((s) => (
            <span key={s.id} className={'seg' + (s.d ? ' on' : '')} />
          ))}
        </div>
      )}
      <div className="meta">
        <span>{subs.length ? `${done}/${subs.length} pieces` : 'no pieces'}</span>
        {sprint && <span className="sp">⊳ {sprint.name.split('·')[0].trim()}</span>}
        <span className="r">
          <button className="mbtn" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleCard(task.id)}>▾</button>
          <button className="mbtn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setModal({ type: 'task', id: task.id })}>✎</button>
          <button className="mbtn" onPointerDown={(e) => e.stopPropagation()} onClick={delTask}>×</button>
        </span>
      </div>
      {isOpen && (
        <div className="subs" onPointerDown={(e) => e.stopPropagation()}>
          {subs.map((s) => (
            <div className="sub" key={s.id}>
              <span className={'sbox' + (s.d ? ' d' : '')} onClick={() => toggleSub(s.id)} />
              <span className={'stxt' + (s.d ? ' d' : '')}>{s.t}</span>
              <button className="sdel" onClick={() => delSub(s.id)}>×</button>
            </div>
          ))}
          <div className="subadd">
            <input
              placeholder="+ split into a piece…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
