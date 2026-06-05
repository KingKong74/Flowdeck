import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import { useApp } from '../store/AppContext'
import type { Project, CanvasNode, NodeType, NodeTag } from '../types'
import { NTYPE, ADDABLE_TYPES, TAGS, COLS, barColor, isBuildable, bestHandles, syncNodeTask, uid, toggleFullscreen } from '../lib/helpers'

type NData = { nid: string; pid: string }
type AddOpts = { pos?: { x: number; y: number }; fromId?: string }
type RC = { from: string; sx: number; sy: number; cx: number; cy: number; icx: number; icy: number }

const toRFNode = (n: CanvasNode, pid: string): Node => ({ id: n.id, type: 'feature', position: { x: n.x, y: n.y }, data: { nid: n.id, pid } })
const toRFEdge = (e: { id: string; from: string; to: string; fromHandle?: string; toHandle?: string }): Edge => ({
  id: e.id, source: e.from, target: e.to, sourceHandle: e.fromHandle, targetHandle: e.toHandle,
})

export default function FlowMap({ project }: { project: Project }) {
  return (
    <ReactFlowProvider>
      <Canvas project={project} />
    </ReactFlowProvider>
  )
}

const nodeTypes = { feature: FeatureNode }

function Canvas({ project }: { project: Project }) {
  const { mutate, setModal, theme } = useApp()
  const rf = useReactFlow()

  const initialNodes = useMemo(() => project.canvas.nodes.map((n) => toRFNode(n, project.id)), [project.id])
  const initialEdges = useMemo<Edge[]>(() => project.canvas.edges.map(toRFEdge), [project.id])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number; fx: number; fy: number } | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [rc, setRc] = useState<RC | null>(null)
  const [rcHover, setRcHover] = useState<string | null>(null)
  const rcMoved = useRef(false)
  const clearMenus = () => { setPaneMenu(null); setNodeMenu(null) }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearMenus(); setRc(null); setRcHover(null) } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const edgeExists = (a: string, b: string) => project.canvas.edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))

  // connect via dragging/clicking a connector dot (user picks the side)
  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target || edgeExists(c.source, c.target)) return
    const id = uid()
    setEdges((eds) => addEdge({ ...c, id }, eds))
    mutate((d) => d.projects.find((p) => p.id === project.id)!.canvas.edges.push({ id, from: c.source!, to: c.target!, fromHandle: c.sourceHandle ?? undefined, toHandle: c.targetHandle ?? undefined }))
  }

  // connect with smart side selection (right-drag, add-connected)
  const createEdgeSmart = (from: string, to: string) => {
    if (from === to || edgeExists(from, to)) return
    const a = project.canvas.nodes.find((n) => n.id === from)
    const b = project.canvas.nodes.find((n) => n.id === to)
    if (!a || !b) return
    const h = bestHandles(a, b)
    const id = uid()
    setEdges((es) => [...es, { id, source: from, target: to, sourceHandle: h.from, targetHandle: h.to }])
    mutate((d) => d.projects.find((p) => p.id === project.id)!.canvas.edges.push({ id, from, to, fromHandle: h.from, toHandle: h.to }))
  }

  // ----- right-button drag to connect -----
  const nodeCenterScreen = (id: string) => {
    const n = project.canvas.nodes.find((x) => x.id === id)!
    return rf.flowToScreenPosition({ x: n.x + 104, y: n.y + 30 })
  }
  const onWrapMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return
    const el = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null
    const id = el?.getAttribute('data-id')
    if (!id) return
    rcMoved.current = false
    const c = nodeCenterScreen(id)
    setRc({ from: id, sx: c.x, sy: c.y, cx: e.clientX, cy: e.clientY, icx: e.clientX, icy: e.clientY })
  }
  useEffect(() => {
    if (!rc) return
    const targetUnder = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.react-flow__node')?.getAttribute('data-id') || null
    const move = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - rc.icx, e.clientY - rc.icy) > 5) rcMoved.current = true
      setRc((r) => (r ? { ...r, cx: e.clientX, cy: e.clientY } : r))
      const t = targetUnder(e.clientX, e.clientY)
      setRcHover(t && t !== rc.from ? t : null)
    }
    const up = (e: MouseEvent) => {
      const to = targetUnder(e.clientX, e.clientY)
      if (rcMoved.current && to && to !== rc.from) createEdgeSmart(rc.from, to)
      setRc(null); setRcHover(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [rc?.from]) // eslint-disable-line react-hooks/exhaustive-deps
  const onWrapContextMenuCapture = (e: React.MouseEvent) => {
    if (rcMoved.current) { e.preventDefault(); e.stopPropagation(); rcMoved.current = false }
  }

  const onNodeDragStop = (_: unknown, node: Node) =>
    mutate((d) => { const n = d.projects.find((p) => p.id === project.id)!.canvas.nodes.find((x) => x.id === node.id); if (n) { n.x = node.position.x; n.y = node.position.y } })

  const onBeforeDelete = async ({ nodes: nds, edges: eds }: { nodes: Node[]; edges: Edge[] }) => ({
    nodes: nds.filter((n) => project.canvas.nodes.find((x) => x.id === n.id)?.type !== 'app'),
    edges: eds,
  })
  const onNodesDelete = (deleted: Node[]) => {
    const ids = deleted.map((n) => n.id)
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.nodes = pr.canvas.nodes.filter((n) => !ids.includes(n.id))
      pr.canvas.edges = pr.canvas.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to))
      pr.tasks = pr.tasks.filter((t) => !(t.mapNodeId && ids.includes(t.mapNodeId) && (t.status === 'todo' || t.status === 'backlog')))
    })
  }
  const onEdgesDelete = (deleted: Edge[]) => {
    const ids = deleted.map((e) => e.id)
    mutate((d) => { const pr = d.projects.find((p) => p.id === project.id)!; pr.canvas.edges = pr.canvas.edges.filter((e) => !ids.includes(e.id)) })
  }
  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setEdges((es) => es.map((x) => (x.id === edge.id ? { ...x, className: 'edge-break', selectable: false } : x)))
    setTimeout(() => rf.deleteElements({ edges: [{ id: edge.id }] }), 360)
  }

  const addNode = (type: NodeType, opts: AddOpts = {}) => {
    let pos = opts.pos
    if (!pos && opts.fromId) {
      const src = project.canvas.nodes.find((n) => n.id === opts.fromId)
      if (src) pos = { x: src.x + 264, y: src.y + 24 }
    }
    if (!pos) pos = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: 260 })
    const node: CanvasNode = { id: uid(), title: 'New ' + type, note: '', type, tags: [], x: pos.x, y: pos.y, color: NTYPE[type] }
    const edgeId = opts.fromId ? uid() : null
    let h: { from: string; to: string } | null = null
    if (opts.fromId) { const src = project.canvas.nodes.find((n) => n.id === opts.fromId); if (src) h = bestHandles(src, node) }
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.nodes.push(node)
      if (opts.fromId && edgeId) pr.canvas.edges.push({ id: edgeId, from: opts.fromId, to: node.id, fromHandle: h?.from, toHandle: h?.to })
      if (isBuildable(node)) syncNodeTask(pr, node)
    })
    setNodes((ns) => [...ns, toRFNode(node, project.id)])
    if (opts.fromId && edgeId) setEdges((es) => [...es, { id: edgeId, source: opts.fromId!, target: node.id, sourceHandle: h?.from, targetHandle: h?.to }])
    clearMenus()
  }

  const menuIsApp = nodeMenu && project.canvas.nodes.find((n) => n.id === nodeMenu.id)?.type === 'app'
  const displayNodes = useMemo(
    () => (rc || rcHover ? nodes.map((n) => (n.id === rc?.from ? { ...n, className: 'connect-src' } : n.id === rcHover ? { ...n, className: 'connect-tgt' } : n)) : nodes),
    [nodes, rc?.from, rcHover],
  )

  const quickAdds = (opts: AddOpts) =>
    ADDABLE_TYPES.map((t) => (
      <button key={t.type} onClick={() => addNode(t.type, opts)}><span className="swt" style={{ background: NTYPE[t.type] }} />{t.label}</button>
    ))

  return (
    <>
      <div className="maptools">
        <button className="btn primary sm" onClick={() => addNode('feature')}>+ Feature</button>
        <button className="btn sm" onClick={() => addNode('idea')}><span style={{ width: 8, height: 8, borderRadius: 2, background: NTYPE.idea, display: 'inline-block' }} /> Idea</button>
        <button className="btn sm" onClick={() => addNode('fix')}><span style={{ width: 8, height: 8, borderRadius: 2, background: NTYPE.fix, display: 'inline-block' }} /> Fix</button>
        <span className="hint">{rc ? 'release on a node to connect' : 'right-click to add · drag a dot or right-drag a node to connect'}</span>
        <button className="btn sm" onClick={() => setModal({ type: 'sync' })}>Export / Sync ▾</button>
        <button className="ico" title="Help" onClick={() => setModal({ type: 'help' })}>?</button>
        <button className="ico" title="Fullscreen" onClick={(e) => toggleFullscreen((e.currentTarget as HTMLElement).closest('.main'))}>⤢</button>
      </div>

      <div className={'canvas-wrap' + (connecting || rc ? ' connecting' : '')} onMouseDown={onWrapMouseDown} onContextMenuCapture={onWrapContextMenuCapture}>
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={() => setConnecting(false)}
          onEdgeClick={onEdgeClick}
          onNodeDragStop={onNodeDragStop}
          onBeforeDelete={onBeforeDelete}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onPaneClick={clearMenus}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            const me = e as React.MouseEvent
            const fp = rf.screenToFlowPosition({ x: me.clientX, y: me.clientY })
            setNodeMenu(null)
            setPaneMenu({ x: me.clientX, y: me.clientY, fx: fp.x, fy: fp.y })
          }}
          onNodeContextMenu={(e, node) => { e.preventDefault(); setPaneMenu(null); setNodeMenu({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, id: node.id }) }}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          connectOnClick
          connectionRadius={90}
          connectionLineStyle={{ stroke: 'var(--ink)', strokeWidth: 2 }}
          panOnDrag={[0]}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={theme === 'light' ? '#e4e4e7' : '#181818'} gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {rc && (
          <svg className="rc-line" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 60 }}>
            <line x1={rc.sx} y1={rc.sy} x2={rc.cx} y2={rc.cy} stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 4" />
          </svg>
        )}

        {(paneMenu || nodeMenu) && <div className="ctx-backdrop" onClick={clearMenus} onContextMenu={(e) => { e.preventDefault(); clearMenus() }} />}

        {paneMenu && (
          <div className="ctxmenu" style={{ left: paneMenu.x, top: paneMenu.y }}>
            <div className="lbl">Add node</div>
            {quickAdds({ pos: { x: paneMenu.fx, y: paneMenu.fy } })}
          </div>
        )}
        {nodeMenu && (
          <div className="ctxmenu" style={{ left: nodeMenu.x, top: nodeMenu.y }}>
            <div className="lbl">Add connected</div>
            {quickAdds({ fromId: nodeMenu.id })}
            <div className="sep" />
            <button onClick={() => { setModal({ type: 'node', id: nodeMenu.id }); clearMenus() }}>✎ Edit node</button>
            {!menuIsApp && <button onClick={() => { rf.deleteElements({ nodes: [{ id: nodeMenu.id }] }); clearMenus() }}>× Delete node</button>}
          </div>
        )}
      </div>
    </>
  )
}

function FeatureNode({ data, selected }: NodeProps) {
  const { data: appData, mutate, setModal } = useApp()
  const rf = useReactFlow()
  const { nid, pid } = data as NData
  const proj = appData.projects.find((p) => p.id === pid)
  const n = proj?.canvas.nodes.find((x) => x.id === nid)
  const task = proj?.tasks.find((t) => t.mapNodeId === nid)
  const [editTitle, setEditTitle] = useState(false)
  const [editNote, setEditNote] = useState(false)
  const [tagMenu, setTagMenu] = useState(false)
  if (!n) return null
  const isApp = n.type === 'app'
  const col = task ? COLS.find((c) => c.id === task.status) : null

  const setNode = (fn: (node: CanvasNode) => void, sync = false) =>
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === pid)!
      const node = pr.canvas.nodes.find((x) => x.id === nid)!
      fn(node)
      if (sync) syncNodeTask(pr, node)
    })
  const commitTitle = (val: string) => {
    const v = val.trim() || n.title
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === pid)!
      pr.canvas.nodes.find((x) => x.id === nid)!.title = v
      const t = pr.tasks.find((x) => x.mapNodeId === nid); if (t) t.title = v
    })
    setEditTitle(false)
  }
  const commitNote = (val: string) => { setNode((node) => { node.note = val.trim() }); setEditNote(false) }
  const toggleTag = (tg: NodeTag) => setNode((node) => { node.tags = node.tags.includes(tg) ? node.tags.filter((x) => x !== tg) : [...node.tags, tg] }, true)

  return (
    <div className={'fnode' + (selected ? ' selected' : '') + (isApp ? ' fnode-core' : '')}>
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="l" type="target" position={Position.Left} />
      <Handle id="t" type="source" position={Position.Top} />
      <Handle id="b" type="target" position={Position.Bottom} />

      <div className="fnode-bar" style={{ background: barColor(n) }} />
      <div className="fnode-head">
        {col && <span className="nstat" title={`Board: ${col.nm}`} style={{ background: col.t }} />}
        <span className="ntype" style={{ color: barColor(n) }}>{isApp ? '★ core' : n.type}</span>
        <span className="nacts">
          {!isApp && (
            <span className="tagwrap nodrag">
              <button className="mbtn" title="Tags" onClick={() => setTagMenu((v) => !v)}>#</button>
              {tagMenu && (
                <span className="tagmenu" onMouseLeave={() => setTagMenu(false)}>
                  {(['idea', 'risk'] as NodeTag[]).map((tg) => (
                    <button key={tg} className={n.tags.includes(tg) ? 'on' : ''} style={{ color: TAGS[tg].color }} onClick={() => toggleTag(tg)}>
                      {n.tags.includes(tg) ? '✓' : '+'} {TAGS[tg].label}
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
          <button className="mbtn nodrag" onClick={() => setModal({ type: 'node', id: n.id })}>✎</button>
          {!isApp && <button className="mbtn nodrag" onClick={() => rf.deleteElements({ nodes: [{ id: n.id }] })}>×</button>}
        </span>
      </div>

      {editTitle ? (
        <input className="fnode-edit nodrag" autoFocus defaultValue={n.title}
          onBlur={(e) => commitTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTitle((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditTitle(false) }} />
      ) : (
        <div className="fnode-title" onDoubleClick={() => setEditTitle(true)}>{n.title}</div>
      )}

      {editNote ? (
        <textarea className="fnode-edit-note nodrag" autoFocus defaultValue={n.note}
          onBlur={(e) => commitNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setEditNote(false) }} />
      ) : n.note ? (
        <div className="fnode-note" onDoubleClick={() => setEditNote(true)}>{n.note}</div>
      ) : (
        <button className="fnode-addnote nodrag" onClick={() => setEditNote(true)}>+ note</button>
      )}

      {n.tags.length > 0 && (
        <div className="fnode-tags">
          {n.tags.map((tg) => (
            <span key={tg} className="ntag nodrag" title="click to remove" onClick={() => toggleTag(tg)} style={{ color: TAGS[tg].color, borderColor: TAGS[tg].color }}>{TAGS[tg].label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
