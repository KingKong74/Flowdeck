import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { Priority, NodeType, NodeTag, Status, WorkspaceKind, BacklogStatus, CanvasNode } from '../types'
import { COLORS, NTYPE, ADDABLE_TYPES, TAGS, TYPE_LABEL, barColor, isBuildable, syncNodeTask, uid } from '../lib/helpers'
import { buildableNodes, canvasToMarkdown, canvasToJSON, canvasToPrompt, download, copyToClipboard } from '../lib/exportMap'
import { buildCanvasFromPaths, pathsFromFileList, readContents, readDrop, type ImportResult } from '../lib/importProject'
import { getFile, setFiles } from '../lib/fileStore'

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
    case 'import': return <ImportForm target={modal.target} />
    case 'explain': return <ExplainModal id={modal.id} />
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
  const appCount = p.canvas.nodes.filter((x) => x.type === 'app').length
  const canDelete = !isApp || appCount > 1
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
    if (isApp && appCount <= 1) return
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
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {appCount > 1
            ? 'This is a Core node. You have more than one, so this duplicate can be deleted.'
            : 'This is the App / Core root — every map keeps one, so the last core can\u2019t be deleted or retyped.'}
        </p>
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
        {canDelete && <button className="btn ghost danger" onClick={del}>Delete</button>}
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

/* ---- import a project folder ---- */
function ImportForm({ target }: { target?: string }) {
  const { mutate, setModal, setUI, openProject, ui } = useApp()
  const close = () => setModal({ type: null })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const el = inputRef.current; if (el) { el.setAttribute('webkitdirectory', ''); el.setAttribute('directory', '') } }, [])

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy(true)
    setResult(buildCanvasFromPaths(pathsFromFileList(files)))
    setContents(await readContents(files))
    setBusy(false)
  }
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const items = Array.from(e.dataTransfer.items)
    setBusy(true)
    if (items.length) {
      const { paths, contents: c } = await readDrop(items)
      if (paths.length) { setResult(buildCanvasFromPaths(paths)); setContents(c) }
    } else if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files)
      setResult(buildCanvasFromPaths(pathsFromFileList(files)))
      setContents(await readContents(files))
    }
    setBusy(false)
  }

  const persistContents = (nodes: { id: string; path?: string }[]) => {
    const byId: Record<string, string> = {}
    nodes.forEach((n) => { if (n.path && contents[n.path]) byId[n.id] = contents[n.path] })
    if (Object.keys(byId).length) setFiles(byId)
  }

  const create = () => {
    if (!result) return
    if (target) {
      const idmap: { id: string; path?: string }[] = []
      mutate((d) => {
        const pr = d.projects.find((p) => p.id === target)!
        const dy = pr.canvas.nodes.length ? pr.canvas.nodes.reduce((m, n) => Math.max(m, n.y), 0) + 160 : 0
        result.canvas.nodes.forEach((n) => { const nn = { ...n, y: n.y + dy }; pr.canvas.nodes.push(nn); idmap.push({ id: nn.id, path: nn.path }) })
        result.canvas.edges.forEach((e) => pr.canvas.edges.push(e))
      })
      persistContents(idmap)
      setUI({ projectTab: 'map' })
    } else {
      const nid = uid()
      mutate((d) => d.projects.push({ id: nid, name: result.name, color: COLORS[d.projects.length % COLORS.length], workspace: ui.workspace, sprints: [], tasks: [], canvas: result.canvas }))
      persistContents(result.canvas.nodes)
      openProject(nid)
      setUI({ projectTab: 'map' })
    }
    close()
  }

  return (
    <Shell close={close} wide>
      <h3>{target ? 'Import into this map' : 'Import a project'}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Pick your project folder — Flowdeck reads the directory structure <b>in your browser</b> (nothing is uploaded) and scaffolds a map from it. <code>node_modules</code>, build output and lockfiles are skipped.
      </p>
      <div
        className={'dropzone' + (drag ? ' over' : '')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={onFiles} />
        {busy ? (
          <div className="dz-empty"><b>Reading folder…</b><span>parsing structure & file contents</span></div>
        ) : result ? (
          <div className="dz-res">
            <b>{result.name}</b>
            <span>{result.nodeCount} nodes · {result.fileCount} files scanned</span>
            <span className="muted">Click to choose a different folder</span>
          </div>
        ) : (
          <div className="dz-empty"><b>Drop your project folder here</b><span>or click to choose</span></div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>Folders and files become nodes (typed automatically), nested up to 4 levels with the root as the core. Big folders cap at 30 files; prune and tag from there.</p>
      <div className="mact">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!result} onClick={create}>{target ? 'Add to map' : 'Create project'}</button>
      </div>
    </Shell>
  )
}

/* ---- explain a node / file ---- */
function summarize(n: CanvasNode, content?: string): string {
  if (!content) return n.note || `A ${TYPE_LABEL[n.type].toLowerCase()} in your project.`
  const lines = content.split('\n').length
  const ext = (n.path?.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
  const exports = [...content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1])
  const imports = (content.match(/^\s*import\s/gm) || []).length
  const bits = [`${lines} lines`]
  if (ext) bits.push(`.${ext}`)
  if (imports) bits.push(`${imports} import${imports > 1 ? 's' : ''}`)
  if (exports.length) bits.push(`exports ${exports.slice(0, 4).join(', ')}${exports.length > 4 ? '…' : ''}`)
  return bits.join('  ·  ')
}
function ExplainModal({ id }: { id: string }) {
  const { activeProject, setModal } = useApp()
  const close = () => setModal({ type: null })
  const p = activeProject()
  const n = p?.canvas.nodes.find((x) => x.id === id)
  if (!n) return null
  const content = getFile(id)
  return (
    <Shell close={close} wide>
      <h3>{n.title}</h3>
      <div className="exp-meta">
        <span className="exp-pill" style={{ color: barColor(n), borderColor: barColor(n) }}>{TYPE_LABEL[n.type]}</span>
        {n.path && <span className="exp-path">{n.path}</span>}
      </div>
      <p className="exp-sum">{summarize(n, content)}</p>
      {content ? (
        <pre className="exp-code">{content}</pre>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
          {n.note ? n.note + ' · ' : ''}No file contents captured (manual node, binary, or oversized). When you connect the Claude API, a full AI walkthrough of this file will appear here.
        </p>
      )}
      <div className="mact"><button className="btn primary" onClick={close}>Close</button></div>
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
