import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { Priority, NodeType, Status, WorkspaceKind, BacklogStatus } from '../types'
import { COLORS, NTYPE, uid } from '../lib/helpers'

export default function Modals() {
  const { modal, setModal } = useApp()
  if (modal.type === null) return null
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setModal({ type: null })}>
      <Body />
    </div>
  )
}

function Body() {
  const { modal } = useApp()
  switch (modal.type) {
    case 'project':
      return <ProjectForm id={modal.id} />
    case 'sprint':
      return <SprintForm />
    case 'task':
      return <TaskForm id={modal.id} status={modal.status} />
    case 'node':
      return <NodeForm id={modal.id} />
    case 'backlog':
      return <BacklogForm id={modal.id} status={modal.status} />
    default:
      return null
  }
}

function useEsc(close: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [close])
}

function Shell({ children, close }: { children: React.ReactNode; close: () => void }) {
  useEsc(close)
  return (
    <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

/* ---- project ---- */
function ProjectForm({ id }: { id?: string }) {
  const { data, ui, mutate, setModal, wsProjects, openProject } = useApp()
  const close = () => setModal({ type: null })
  const editing = id ? data.projects.find((p) => p.id === id) : null
  const ws: WorkspaceKind = editing ? editing.workspace : ui.workspace
  const [name, setName] = useState(editing?.name ?? '')
  const [client, setClient] = useState(editing?.client ?? '')
  const [domain, setDomain] = useState(editing?.domain ?? '')
  const [desc, setDesc] = useState(editing?.desc ?? '')
  const [color, setColor] = useState(editing?.color ?? COLORS[wsProjects().length % COLORS.length])

  const save = () => {
    if (!name.trim()) return
    if (editing) {
      mutate((d) => {
        const p = d.projects.find((x) => x.id === id)!
        p.name = name.trim()
        p.desc = desc.trim()
        p.color = color
        p.domain = domain.trim()
        p.client = client.trim()
      })
    } else {
      const nid = uid()
      mutate((d) =>
        d.projects.push({
          id: nid,
          name: name.trim(),
          desc: desc.trim(),
          color,
          domain: domain.trim(),
          client: client.trim(),
          workspace: ws,
          sprints: [],
          tasks: [],
          canvas: { nodes: [], edges: [] },
        }),
      )
      openProject(nid)
    }
    close()
  }

  return (
    <Shell close={close}>
      <h3>{editing ? 'Edit project' : `New ${ws === 'professional' ? 'client ' : ''}project`}</h3>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ws === 'professional' ? 'Client project name' : 'Portfolio rebuild'} autoFocus />
      </Field>
      {ws === 'professional' && (
        <Field label="Client">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Co" />
        </Field>
      )}
      <Field label="Domain / subtitle">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={ws === 'professional' ? 'acme.com' : 'optional'} />
      </Field>
      <Field label="Description">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="what is this" />
      </Field>
      <Field label="Colour">
        <div className="swatches">
          {COLORS.map((c) => (
            <span key={c} className={'sw' + (c === color ? ' sel' : '')} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </Field>
      <Actions close={close} onSave={save} />
    </Shell>
  )
}

/* ---- sprint ---- */
function SprintForm() {
  const { mutate, activeProject, setModal } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()!
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<'planned' | 'active' | 'done'>('planned')
  const save = () => {
    if (!name.trim()) return
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      pr.sprints.push({ id: uid(), name: name.trim(), goal: goal.trim(), status })
    })
    close()
  }
  return (
    <Shell close={close}>
      <h3>New sprint</h3>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 3 · Auth" autoFocus /></Field>
      <Field label="Goal"><input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="the one outcome that matters" /></Field>
      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Actions close={close} onSave={save} saveLabel="Create" />
    </Shell>
  )
}

/* ---- task ---- */
function TaskForm({ id, status }: { id?: string; status?: Status }) {
  const { mutate, activeProject, setModal } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()!
  const editing = id ? p.tasks.find((t) => t.id === id) : null
  const [title, setTitle] = useState(editing?.title ?? '')
  const [sprintId, setSprintId] = useState(editing?.sprintId ?? '')
  const [prio, setPrio] = useState<Priority>(editing?.prio ?? 'med')
  const save = () => {
    if (!title.trim()) return
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      if (editing) {
        const t = pr.tasks.find((x) => x.id === id)!
        t.title = title.trim()
        t.sprintId = sprintId || null
        t.prio = prio
      } else {
        pr.tasks.push({ id: uid(), title: title.trim(), status: status ?? 'backlog', sprintId: sprintId || null, prio, subs: [] })
      }
    })
    close()
  }
  return (
    <Shell close={close}>
      <h3>{editing ? 'Edit task' : 'New task'}</h3>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="what needs doing" autoFocus /></Field>
      <Field label="Sprint">
        <select value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
          <option value="">— Unassigned —</option>
          {p.sprints.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <Pick options={['high', 'med', 'low']} value={prio} onPick={(v) => setPrio(v as Priority)} />
      </Field>
      <Actions close={close} onSave={save} />
    </Shell>
  )
}

/* ---- node ---- */
function NodeForm({ id }: { id: string }) {
  const { mutate, activeProject, setModal } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()!
  const n = p.canvas.nodes.find((x) => x.id === id)
  const [title, setTitle] = useState(n?.title ?? '')
  const [note, setNote] = useState(n?.note ?? '')
  const [type, setType] = useState<NodeType>(n?.type ?? 'feature')
  if (!n) return null
  const save = () => {
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      const node = pr.canvas.nodes.find((x) => x.id === id)!
      node.title = title.trim() || 'Untitled'
      node.note = note.trim()
      node.type = type
      node.color = NTYPE[type]
    })
    close()
  }
  const del = () => {
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      pr.canvas.nodes = pr.canvas.nodes.filter((x) => x.id !== id)
      pr.canvas.edges = pr.canvas.edges.filter((e) => e.from !== id && e.to !== id)
    })
    close()
  }
  return (
    <Shell close={close}>
      <h3>Edit node</h3>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
      <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="details, scope, questions…" /></Field>
      <Field label="Type">
        <Pick options={['feature', 'idea', 'milestone', 'risk']} value={type} onPick={(v) => setType(v as NodeType)} />
      </Field>
      <div className="mact">
        <button className="btn ghost danger" onClick={del}>Delete</button>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={save}>Save</button>
      </div>
    </Shell>
  )
}

/* ---- backlog ---- */
function BacklogForm({ id, status }: { id?: string; status?: string }) {
  const { data, mutate, setModal } = useApp()
  const close = () => setModal({ type: null })
  const editing = id ? data.backlog.find((i) => i.id === id) : null
  const [title, setTitle] = useState(editing?.title ?? '')
  const [cat, setCat] = useState(editing?.cat ?? '')
  const save = () => {
    if (!title.trim()) return
    mutate((d) => {
      if (editing) {
        const it = d.backlog.find((x) => x.id === id)!
        it.title = title.trim()
        it.cat = cat.trim() || 'misc'
      } else {
        d.backlog.push({ id: uid(), title: title.trim(), cat: cat.trim() || 'misc', status: (status as BacklogStatus) ?? 'todo' })
      }
    })
    close()
  }
  return (
    <Shell close={close}>
      <h3>{editing ? 'Edit item' : 'New item'}</h3>
      <Field label="What"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="fix car" autoFocus /></Field>
      <Field label="Tag"><input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="errands, social, music" /></Field>
      <Actions close={close} onSave={save} />
    </Shell>
  )
}

/* ---- shared bits ---- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}
function Pick({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="pick">
      {options.map((o) => (
        <div key={o} className={'opt' + (o === value ? ' sel' : '')} onClick={() => onPick(o)}>{o}</div>
      ))}
    </div>
  )
}
function Actions({ close, onSave, saveLabel = 'Save' }: { close: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <div className="mact">
      <button className="btn ghost" onClick={close}>Cancel</button>
      <button className="btn primary" onClick={onSave}>{saveLabel}</button>
    </div>
  )
}
