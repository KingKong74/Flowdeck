import type { Project, Task, Status, Priority, NodeType } from '../types'

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

export const NTYPE: Record<NodeType, string> = {
  feature: '#0072f5',
  idea: '#f5a623',
  milestone: '#0cce6b',
  risk: '#e5484d',
}

export const BL: { id: 'todo' | 'doing' | 'done'; nm: string; t: string }[] = [
  { id: 'todo', nm: 'To Do', t: '#0072f5' },
  { id: 'doing', nm: 'Doing', t: '#f5a623' },
  { id: 'done', nm: 'Done', t: '#0cce6b' },
]

const FALLBACK: Record<Status, number> = {
  backlog: 0,
  todo: 5,
  'in-progress': 40,
  review: 80,
  done: 100,
}

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
  if (pct === 100 && p.tasks.length) return { c: '#0cce6b', i: '✓' }
  if (active || p.tasks.some((t) => t.status === 'in-progress')) return { c: '#f5a623', i: '◴' }
  return { c: '#52606d', i: '·' }
}
