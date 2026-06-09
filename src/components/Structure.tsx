import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { Project, CanvasNode } from '../types'
import { TAGS, COLS, TYPE_LABEL, barColor } from '../lib/helpers'

type TNode = { node: CanvasNode; depth: number; children: TNode[] }

function buildForest(p: Project) {
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  p.canvas.edges.forEach((e) => { if (!children.has(e.from)) children.set(e.from, []); children.get(e.from)!.push(e.to); hasParent.add(e.to) })
  const byId = new Map(p.canvas.nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const containers: string[] = []
  const deep: string[] = []
  const sortKids = (ids: string[]) =>
    ids.slice().sort((a, b) => {
      const ca = (children.get(a)?.length || 0) > 0, cb = (children.get(b)?.length || 0) > 0
      if (ca !== cb) return ca ? -1 : 1
      return (byId.get(a)?.title || '').localeCompare(byId.get(b)?.title || '')
    })
  const build = (id: string, depth: number): TNode | null => {
    if (visited.has(id)) return null
    visited.add(id)
    const node = byId.get(id)
    if (!node) return null
    const kidIds = sortKids(children.get(id) || [])
    if (kidIds.length) { containers.push(id); if (depth >= 2) deep.push(id) }
    const kids = kidIds.map((k) => build(k, depth + 1)).filter(Boolean) as TNode[]
    return { node, depth, children: kids }
  }
  const forest: TNode[] = []
  const app = p.canvas.nodes.find((n) => n.type === 'app')
  if (app) { const t = build(app.id, 0); if (t) forest.push(t) }
  p.canvas.nodes.forEach((n) => { if (!visited.has(n.id)) { const t = build(n.id, 0); if (t) forest.push(t) } })
  return { forest, containers, deep }
}

export default function Structure({ project }: { project: Project }) {
  const { setModal, setUI } = useApp()
  const { forest, containers } = useMemo(() => buildForest(project), [project])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(buildForest(project).deep))
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const flat: TNode[] = []
  const push = (t: TNode) => { flat.push(t); if (t.children.length && !collapsed.has(t.node.id)) t.children.forEach(push) }
  forest.forEach(push)

  return (
    <div className="scroll tree-wrap">
      <div className="tree-head">
        <span className="hint">Hierarchy from your map — click a row to read what it does.</span>
        <span className="tree-actions">
          <button className="btn sm" onClick={() => setCollapsed(new Set())}>Expand all</button>
          <button className="btn sm" onClick={() => setCollapsed(new Set(containers))}>Collapse all</button>
        </span>
      </div>
      <div className="tree">
        {flat.map(({ node, depth, children }) => {
          const task = project.tasks.find((t) => t.mapNodeId === node.id)
          const col = task ? COLS.find((c) => c.id === task.status) : null
          const hasKids = children.length > 0
          return (
            <div className="trow" key={node.id} style={{ paddingLeft: depth * 20 + 6 }} onClick={() => setModal({ type: 'explain', id: node.id })}>
              {hasKids ? (
                <button className="tchev" onClick={(e) => { e.stopPropagation(); toggle(node.id) }}>{collapsed.has(node.id) ? '▸' : '▾'}</button>
              ) : (
                <span className="tchev-sp" />
              )}
              <span className="tdot" style={{ background: barColor(node) }} />
              <span className="tname">{node.title}</span>
              <span className="ttype">{node.type === 'app' ? 'core' : TYPE_LABEL[node.type]}</span>
              {node.tags.map((tg) => (
                <span key={tg} className="ttag" style={{ color: TAGS[tg].color, borderColor: TAGS[tg].color }}>{TAGS[tg].label}</span>
              ))}
              {col && <span className="tstat" title={`Board: ${col.nm}`} style={{ background: col.t }} />}
            </div>
          )
        })}
        {!flat.length && <div className="tempty">No nodes yet — build your map first. <button className="link" onClick={() => setUI({ projectTab: 'map' })}>Open Map →</button></div>}
      </div>
    </div>
  )
}
