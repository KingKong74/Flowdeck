import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { Priority, NodeType, NodeTag, Status, WorkspaceKind, BacklogStatus } from '../types'
import { COLORS, NTYPE, ADDABLE_TYPES, TAGS, TYPE_LABEL, isBuildable, syncNodeTask, uid } from '../lib/helpers'
import { buildableNodes, canvasToMarkdown, canvasToJSON, canvasToPrompt, download, copyToClipboard } from '../lib/exportMap'

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
    case 'project': return <ProjectForm id={modal.id} />
    case 'sprint': return <SprintForm />
    case 'task': return <TaskForm id={modal.id} status={modal.status} />
    case 'node': return <NodeForm id={modal.id} />
    case 'backlog': return <BacklogForm id={modal.id} status={modal.status} />
    case 'sync': return <SyncForm />
    case 'help': return <HelpModal />
    default: return null
  }
}

function useEsc(close: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [close])
}
function Shell({ children, close, wide }: { children: React.ReactNode; close: () => void; wide?: boolean }) {
  useEsc(close)
  return (
    <div className="modal" style={wide ? { width: 'min(520px, 94vw)' } : undefined} onMouseDown={(e) => e.stopPropagation()}>
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
        p.name = name.trim(); p.desc = desc.trim(); p.color = color; p.domain = domain.trim(); p.client = client.trim()
      })
    } else {
      const nid = uid()
      mutate((d) =>
        d.projects.push({
          id: nid, name: name.trim(), desc: desc.trim(), color, domain: domain.trim(), client: client.trim(),
          workspace: ws, sprints: [], tasks: [],
          canvas: { nodes: [{ id: uid(), title: name.trim(), note: '', type: 'app', tags: [], x: 380, y: 40, color: NTYPE.app }], edges: [] },
        }),
      )
      openProject(nid)
    }
    close()
  }

  return (
    <Shell close={close}>
      <h3>{editing ? 'Edit project' : `New ${ws === 'professional' ? 'client ' : ''}project`}</h3>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={ws === 'professional' ? 'Client project name' : 'Portfolio rebuild'} autoFocus /></Field>
      {ws === 'professional' && <Field label="Client"><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Co" /></Field>}
      <Field label="Domain / subtitle"><input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={ws === 'professional' ? 'acme.com' : 'optional'} /></Field>
      <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="what is this" /></Field>
      <Field label="Colour">
        <div className="swatches">{COLORS.map((c) => <span key={c} className={'sw' + (c === color ? ' sel' : '')} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
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
    mutate((d) => d.projects.find((x) => x.id === p.id)!.sprints.push({ id: uid(), name: name.trim(), goal: goal.trim(), status }))
    close()
  }
  return (
    <Shell close={close}>
      <h3>New sprint</h3>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 3 · Auth" autoFocus /></Field>
      <Field label="Goal"><input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="the one outcome that matters" /></Field>
      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="planned">Planned</option><option value="active">Active</option><option value="done">Done</option>
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
  const [due, setDue] = useState(editing?.due ?? '')
  const save = () => {
    if (!title.trim()) return
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      if (editing) {
        const t = pr.tasks.find((x) => x.id === id)!
        t.title = title.trim(); t.sprintId = sprintId || null; t.prio = prio; t.due = due || undefined
      } else {
        pr.tasks.push({ id: uid(), title: title.trim(), status: status ?? 'backlog', sprintId: sprintId || null, prio, due: due || undefined, subs: [] })
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
          {p.sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Priority"><Pick options={['high', 'med', 'low']} value={prio} onPick={(v) => setPrio(v as Priority)} /></Field>
      <Field label="Due date"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      <Actions close={close} onSave={save} />
    </Shell>
  )
}

/* ---- node (type + tags) ---- */
function NodeForm({ id }: { id: string }) {
  const { mutate, activeProject, setModal } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()!
  const n = p.canvas.nodes.find((x) => x.id === id)
  const [title, setTitle] = useState(n?.title ?? '')
  const [note, setNote] = useState(n?.note ?? '')
  const [type, setType] = useState<NodeType>(n?.type ?? 'feature')
  const [tags, setTags] = useState<NodeTag[]>(n?.tags ?? [])
  if (!n) return null
  const isApp = n.type === 'app'
  const toggleTag = (tg: NodeTag) => setTags((cur) => (cur.includes(tg) ? cur.filter((x) => x !== tg) : [...cur, tg]))

  const save = () => {
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      const node = pr.canvas.nodes.find((x) => x.id === id)!
      node.title = title.trim() || 'Untitled'
      node.note = note.trim()
      if (!isApp) { node.type = type; node.color = NTYPE[type]; node.tags = tags }
      syncNodeTask(pr, node)
    })
    close()
  }
  const del = () => {
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      pr.canvas.nodes = pr.canvas.nodes.filter((x) => x.id !== id)
      pr.canvas.edges = pr.canvas.edges.filter((e) => e.from !== id && e.to !== id)
      pr.tasks = pr.tasks.filter((t) => !(t.mapNodeId === id && (t.status === 'todo' || t.status === 'backlog')))
    })
    close()
  }

  return (
    <Shell close={close}>
      <h3>{isApp ? 'Core node' : 'Edit node'}</h3>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
      <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="details, scope, questions…" /></Field>
      {isApp ? (
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>This is the App / Core root — every map has one and it can't be deleted or retyped.</p>
      ) : (
        <>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as NodeType)}>
              {ADDABLE_TYPES.map((t) => <option key={t.type} value={t.type}>{TYPE_LABEL[t.type]}</option>)}
            </select>
          </Field>
          <Field label="Tags">
            <div className="pick">
              {(['idea', 'risk'] as NodeTag[]).map((tg) => {
                const on = tags.includes(tg)
                return (
                  <div key={tg} className={'opt' + (on ? ' sel' : '')} onClick={() => toggleTag(tg)}
                    style={on ? { color: TAGS[tg].color, borderColor: TAGS[tg].color } : undefined}>
                    {TAGS[tg].label}
                  </div>
                )
              })}
            </div>
          </Field>
          <p style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>Idea & Fix <i>types</i>, or the Idea <i>tag</i>, export and become board tasks.</p>
        </>
      )}
      <div className="mact">
        {!isApp && <button className="btn ghost danger" onClick={del}>Delete</button>}
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={save}>Save</button>
      </div>
    </Shell>
  )
}

/* ---- sync to board ---- */
function SyncForm() {
  const { mutate, activeProject, setModal, setUI } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()!
  const items = buildableNodes(p)
  const safe = p.name.replace(/\s+/g, '-').toLowerCase()

  const syncToInProgress = () =>
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)!
      pr.canvas.nodes.filter(isBuildable).forEach((node) => {
        const t = pr.tasks.find((x) => x.mapNodeId === node.id)
        if (!t) pr.tasks.push({ id: uid(), title: node.title, status: 'in-progress', sprintId: null, prio: 'med', subs: [], mapNodeId: node.id })
        else t.status = 'in-progress'
      })
    })

  const copyAndBoard = async () => {
    await copyToClipboard(canvasToPrompt(p))
    syncToInProgress()
    setUI({ projectTab: 'board' })
    close()
  }

  return (
    <Shell close={close} wide>
      <h3>Export / sync to board</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        {items.length
          ? `${items.length} item${items.length > 1 ? 's' : ''} ready. Copy the spec for Claude — it also moves them to In Progress and opens the board.`
          : 'Nothing to build yet. Tag a node “idea” or “fix” on the map.'}
      </p>
      {items.length > 0 && (
        <div className="sync-list">
          {items.map((n) => {
            const kind = n.type === 'fix' ? 'fix' : 'idea'
            return (
              <div className="sync-item" key={n.id}>
                <span className="d" style={{ background: NTYPE[kind] }} />
                <span>{n.note?.trim() || n.title}</span>
                <span className="ty">{kind}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="sync-actions">
        <button className="btn sm" onClick={() => download(`${safe}-build.md`, canvasToMarkdown(p), 'text/markdown')}>Download .md</button>
        <button className="btn sm" onClick={() => download(`${safe}-build.json`, JSON.stringify(canvasToJSON(p), null, 2), 'application/json')}>Download .json</button>
      </div>
      <div className="mact">
        <button className="btn ghost" onClick={close}>Close</button>
        <button className="btn primary" disabled={!items.length} onClick={copyAndBoard}>Copy for Claude → Board</button>
      </div>
    </Shell>
  )
}

/* ---- help ---- */
function HelpModal() {
  const { setModal } = useApp()
  const close = () => setModal({ type: null })
  return (
    <Shell close={close} wide>
      <h3>How the Map works</h3>
      <div className="help">
        <p><b>Gestures</b></p>
        <ul>
          <li><b>Connect:</b> drag a connector dot onto another node, <i>or</i> press <b>right-click on a node and drag</b> onto the target and release. Strings attach to whichever sides face each other.</li>
          <li><b>Click a string</b> to snap it.</li>
          <li><b>Right-click the canvas</b> to add a node; <b>right-click a node</b> (without dragging) to branch a connected one off it, edit, or delete.</li>
          <li><b>Double-click</b> a title or note to edit inline; empty nodes show <b>+ note</b>. The <b>#</b> button adds tags without opening the editor.</li>
        </ul>
        <p><b>Types</b> — what a node <i>is</i> in your system:</p>
        <ul>
          <li><b>App / Core</b> — the root. One per map, can't be deleted. Everything builds off it.</li>
          {ADDABLE_TYPES.map((t) => (
            <li key={t.type}><span className="swt" style={{ background: NTYPE[t.type] }} /> <b>{t.label}</b> — {t.hint}.</li>
          ))}
        </ul>
        <p><b>Tags</b> — markers layered on any node:</p>
        <ul>
          <li><span className="swt" style={{ background: TAGS.idea.color }} /> <b>Idea</b> — marks any node as something to build (Idea & Fix are also their own types).</li>
          <li><span className="swt" style={{ background: TAGS.risk.color }} /> <b>Risk</b> — a concern to keep an eye on.</li>
        </ul>
        <p style={{ fontSize: 12, color: 'var(--muted-2)' }}>Idea/Fix nodes (or anything tagged Idea) export and become board tasks; everything else is context.</p>
        <p><b>Map → Board flow</b></p>
        <ul>
          <li>Add an <b>Idea</b> or <b>Fix</b> (or tag a node Idea) → a task appears in <b>To Do</b>.</li>
          <li><b>Export / Sync → Copy for Claude</b>: copies the spec, moves those items to <b>In Progress</b>, and opens the board.</li>
          <li>On the board, <b>✓ approve</b> what landed (→ Done — this clears the build tag on the map) or <b>⚑ flag</b> what didn't (→ Review).</li>
          <li>Each map node shows a dot in its linked task's board colour, so the two stay in step.</li>
        </ul>
      </div>
      <div className="mact"><button className="btn primary" onClick={close}>Got it</button></div>
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
      if (editing) { const it = d.backlog.find((x) => x.id === id)!; it.title = title.trim(); it.cat = cat.trim() || 'misc' }
      else d.backlog.push({ id: uid(), title: title.trim(), cat: cat.trim() || 'misc', status: (status as BacklogStatus) ?? 'todo' })
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

/* ---- shared ---- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}
function Pick({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="pick">
      {options.map((o) => <div key={o} className={'opt' + (o === value ? ' sel' : '')} onClick={() => onPick(o)}>{o}</div>)}
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
