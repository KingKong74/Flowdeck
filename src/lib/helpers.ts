import type { Project, Task, Status, Priority, NodeType, NodeTag, CanvasNode } from '../types'

export const uid = () => Math.random().toString(36).slice(2, 9)

export const COLORS = ['#ededed', '#0072f5', '#e5484d', '#f5a623', '#0cce6b', '#8a63d2', '#ff7847']

export const COLS: { id: Status; nm: string; t: string }[] = [
  { id: 'backlog', nm: 'Backlog', t: '#52606d' },
  { id: 'todo', nm: 'To Do', t: '#0072f5' },
  { id: 'in-progress', nm: 'In Progress', t: '#f5a623' },
  { id: 'review', nm: 'Review', t: '#8a63d2' },
  { id: 'done', nm: 'Done', t: '#0cce6b' },
]

export const PRIO: Record<Priority, string> = { high: '#e5484d', med: '#f5a623', low: '#52606d' }

// Architectural node types — what a node IS in the system.
export const NTYPE: Record<NodeType, string> = {
  app: '#a1a1a1', // app/core bar rendered with --ink in the component
  feature: '#0cce6b',
  component: '#0072f5',
  infrastructure: '#16b8c9',
  view: '#8a63d2',
  data: '#e3679b',
  idea: '#f5a623',
  fix: '#38bdf8',
}

// Types you can add (everything except the locked App/Core root).
export const ADDABLE_TYPES: { type: NodeType; label: string; hint: string }[] = [
  { type: 'feature', label: 'Feature', hint: 'A capability or feature area' },
  { type: 'component', label: 'Component', hint: 'A reusable building block / module' },
  { type: 'infrastructure', label: 'Infrastructure', hint: 'Backend, services, plumbing' },
  { type: 'view', label: 'View / Page', hint: 'A screen the user sees' },
  { type: 'data', label: 'Data / Model', hint: 'A schema or data entity' },
  { type: 'idea', label: 'Idea', hint: 'Something new to build — exports & hits the board' },
  { type: 'fix', label: 'Fix', hint: 'A fix or patch — exports & hits the board' },
]

export const TYPE_LABEL: Record<NodeType, string> = {
  app: 'App / Core',
  feature: 'Feature',
  component: 'Component',
  infrastructure: 'Infrastructure',
  view: 'View / Page',
  data: 'Data / Model',
  idea: 'Idea',
  fix: 'Fix',
}

// Orthogonal tags — markers layered on any node.
export const TAGS: Record<NodeTag, { label: string; color: string; hint: string }> = {
  idea: { label: 'Idea', color: '#f5a623', hint: 'Mark anything as something to build' },
  risk: { label: 'Risk', color: '#e5484d', hint: 'A concern to watch' },
}

// "Actionable work" — these export and push to the board: idea/fix TYPES, or the idea TAG.
export const BUILD_TYPES: NodeType[] = ['idea', 'fix']
export const isBuildable = (n: CanvasNode) => BUILD_TYPES.includes(n.type) || (n.tags ?? []).includes('idea')
export const barColor = (n: CanvasNode) => (n.type === 'app' ? 'var(--ink)' : NTYPE[n.type])

export const BL: { id: 'todo' | 'doing' | 'done'; nm: string; t: string }[] = [
  { id: 'todo', nm: 'To Do', t: '#0072f5' },
  { id: 'doing', nm: 'Doing', t: '#f5a623' },
  { id: 'done', nm: 'Done', t: '#0cce6b' },
]

const FALLBACK: Record<Status, number> = { backlog: 0, todo: 5, 'in-progress': 40, review: 80, done: 100 }

export function taskPct(t: Task): number {
  if (t.status === 'done') return 100
  if (!t.subs || !t.subs.length) return FALLBACK[t.status] ?? 0
  return Math.round((t.subs.filter((s) => s.d).length / t.subs.length) * 100)
}
export function projPct(p: Project): number {
  return p.tasks.length ? Math.round(p.tasks.reduce((a, t) => a + taskPct(t), 0) / p.tasks.length) : 0
}
export function projStatus(p: Project): { c: string; i: string } {
  const active = p.sprints.some((s) => s.status === 'active')
  const pct = projPct(p)
  if (pct === 100 && p.tasks.length) return { c: '#0cce6b', i: '\u2713' }
  if (active || p.tasks.some((t) => t.status === 'in-progress')) return { c: '#f5a623', i: '\u25f4' }
  return { c: '#52606d', i: '\u00b7' }
}

// Pick the connector side of each node that faces the other — keeps strings off the right edge.
export function bestHandles(from: { x: number; y: number }, to: { x: number; y: number }): { from: string; to: string } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { from: 'r', to: 'l' } : { from: 'l', to: 'r' }
  return dy >= 0 ? { from: 'b', to: 't' } : { from: 't', to: 'b' }
}

// Keep a node's linked board task consistent with its buildable state.
export function syncNodeTask(pr: Project, node: CanvasNode) {
  const buildable = isBuildable(node)
  const linked = pr.tasks.find((t) => t.mapNodeId === node.id)
  if (buildable && !linked) {
    pr.tasks.push({ id: uid(), title: node.title, status: 'todo', sprintId: null, prio: 'med', subs: [], mapNodeId: node.id })
  } else if (!buildable && linked && (linked.status === 'todo' || linked.status === 'backlog')) {
    pr.tasks = pr.tasks.filter((t) => t.id !== linked.id)
  } else if (linked) {
    linked.title = node.title
  }
}

export function toggleFullscreen(el: Element | null) {
  if (!el) return
  if (document.fullscreenElement) document.exitFullscreen()
  else (el as HTMLElement).requestFullscreen?.()
}
