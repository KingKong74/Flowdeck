import type { AppData, Project, Task, CanvasNode, NodeType, NodeTag } from '../types'
import { uid, NTYPE, bestHandles } from '../lib/helpers'

function mkTask(o: Omit<Partial<Task>, 'subs'> & { title: string; subs?: { t: string; d?: boolean }[] }): Task {
  return {
    id: uid(),
    status: o.status ?? 'backlog',
    sprintId: o.sprintId ?? null,
    prio: o.prio ?? 'med',
    title: o.title,
    mapNodeId: o.mapNodeId,
    subs: (o.subs ?? []).map((s) => ({ id: uid(), t: s.t, d: !!s.d })),
  }
}

function mkNode(o: { id?: string; title: string; note?: string; type: NodeType; tags?: NodeTag[]; x: number; y: number }): CanvasNode {
  return { id: o.id ?? uid(), title: o.title, note: o.note ?? '', type: o.type, tags: o.tags ?? [], x: o.x, y: o.y, color: NTYPE[o.type] }
}

export function proSeed(): Project[] {
  const s1 = uid()
  return [
    {
      id: uid(),
      name: 'Moniqr',
      desc: 'Bank-sync accounting SaaS',
      color: '#8a63d2',
      workspace: 'professional',
      client: 'Moniqr',
      domain: 'moniqr.com',
      sprints: [{ id: s1, name: 'Sprint 1 · Basiq sync', goal: 'Transaction import + FY filtering', status: 'active' }],
      tasks: [
        mkTask({
          title: 'Basiq transaction sync',
          status: 'in-progress',
          sprintId: s1,
          prio: 'high',
          subs: [
            { t: 'Sandbox import (890 tx)', d: true },
            { t: 'AU FY filtering', d: false },
            { t: 'Approval workflow', d: false },
          ],
        }),
        mkTask({
          title: 'Fix tx count discrepancy (890 vs 673)',
          status: 'todo',
          sprintId: s1,
          prio: 'high',
          subs: [
            { t: 'Confirm rows in DB', d: true },
            { t: 'Check FY2026 filter in AppContext', d: false },
          ],
        }),
        mkTask({ title: 'FY2026 date filter logic', status: 'review', sprintId: s1, prio: 'med' }),
      ],
      canvas: { nodes: [mkNode({ title: 'Moniqr', type: 'app', x: 380, y: 40 })], edges: [] },
    },
    {
      id: uid(),
      name: 'Acme Co Website',
      desc: 'Marketing site rebuild',
      color: '#0cce6b',
      workspace: 'professional',
      client: 'Acme Co',
      domain: 'acme.example',
      sprints: [],
      tasks: [mkTask({ title: 'Design handoff review', status: 'todo', prio: 'med' })],
      canvas: { nodes: [mkNode({ title: 'Acme Site', type: 'app', x: 380, y: 40 })], edges: [] },
    },
  ]
}

export function seed(): AppData {
  const s1 = uid(),
    s2 = uid()
  const app = mkNode({ title: 'Flowdeck', type: 'app', x: 380, y: 40 })
  const board = mkNode({ title: 'Board view', note: 'Agile kanban + sprints', type: 'feature', x: 140, y: 260 })
  const map = mkNode({ title: 'Map view', note: 'Feature brainstorming canvas', type: 'feature', x: 420, y: 280 })
  const sync = mkNode({ title: 'Cloud sync', note: 'Sync across devices', type: 'feature', tags: ['idea'], x: 720, y: 260 })

  return {
    meta: { proSeeded: true },
    projects: [
      {
        id: uid(),
        name: 'Flowdeck App',
        color: '#ededed',
        workspace: 'personal',
        desc: 'The workflow tracker you are using right now.',
        sprints: [
          { id: s1, name: 'Sprint 1 · Core', goal: 'Board + map + subtasks', status: 'active' },
          { id: s2, name: 'Sprint 2 · Polish', goal: 'Sync + analytics', status: 'planned' },
        ],
        tasks: [
          mkTask({
            title: 'Build kanban board',
            status: 'done',
            sprintId: s1,
            prio: 'high',
            subs: [
              { t: 'Columns', d: true },
              { t: 'Drag + drop', d: true },
              { t: 'Card design', d: true },
            ],
          }),
          mkTask({
            title: 'Feature map canvas',
            status: 'in-progress',
            sprintId: s1,
            prio: 'high',
            subs: [
              { t: 'Draggable nodes', d: true },
              { t: 'Connect with strings', d: true },
              { t: 'Types + tags', d: false },
            ],
          }),
          mkTask({ title: 'Cloud sync', status: 'todo', sprintId: s2, prio: 'low', mapNodeId: sync.id }),
        ],
        canvas: {
          nodes: [app, board, map, sync],
          edges: [
            { id: uid(), from: app.id, to: board.id },
            { id: uid(), from: app.id, to: map.id },
            { id: uid(), from: map.id, to: sync.id },
          ],
        },
      },
      ...proSeed(),
    ],
    backlog: [
      { id: uid(), title: 'Update Instagram', cat: 'social', status: 'todo' },
      { id: uid(), title: 'Fix Spotify playlists', cat: 'music', status: 'doing' },
      { id: uid(), title: 'Fix the car', cat: 'errands', status: 'todo' },
      { id: uid(), title: 'Renew car rego', cat: 'errands', status: 'todo' },
    ],
  }
}

// Map legacy node types/tags (pre type/tag changes) onto the current model.
function migrateNode(n: CanvasNode): CanvasNode {
  const legacy = n.type as string
  let type: NodeType = 'feature'
  let tags: string[] = Array.isArray(n.tags) ? [...(n.tags as string[])] : []
  if (['app', 'feature', 'component', 'infrastructure', 'view', 'data', 'idea', 'fix', 'module', 'service', 'config', 'test', 'docs'].includes(legacy)) type = legacy as NodeType
  else if (legacy === 'risk') { type = 'component'; if (!tags.includes('risk')) tags.push('risk') }
  else if (legacy === 'milestone') type = 'feature'
  // 'fix' is a TYPE now, not a tag
  if (tags.includes('fix')) { tags = tags.filter((t) => t !== 'fix'); if (type === 'feature') type = 'fix' }
  tags = tags.filter((t) => t === 'idea' || t === 'risk')
  const note = type === 'app' && n.note === 'The core — everything builds off this' ? '' : n.note
  return { ...n, type, tags: tags as NodeTag[], note, color: NTYPE[type] }
}

export function migrate(data: AppData): AppData {
  const d: AppData = { meta: data.meta ?? {}, projects: data.projects ?? [], backlog: data.backlog ?? [] }
  d.projects.forEach((p) => {
    if (!p.canvas) p.canvas = { nodes: [], edges: [] }
    if (!p.workspace) p.workspace = 'personal'
    p.canvas.nodes = p.canvas.nodes.map(migrateNode)
    // guarantee exactly one App/Core root per map
    if (!p.canvas.nodes.some((n) => n.type === 'app')) {
      const cx = p.canvas.nodes.length
        ? Math.round(p.canvas.nodes.reduce((a, n) => a + n.x, 0) / p.canvas.nodes.length)
        : 380
      p.canvas.nodes.unshift(mkNode({ title: p.name, type: 'app', x: cx, y: 40 }))
    }
    // backfill smart handle anchors so old edges don't all hug the right side
    p.canvas.edges = p.canvas.edges.map((e) => {
      if (e.fromHandle && e.toHandle) return e
      const a = p.canvas.nodes.find((n) => n.id === e.from)
      const b = p.canvas.nodes.find((n) => n.id === e.to)
      if (!a || !b) return e
      const h = bestHandles(a, b)
      return { ...e, fromHandle: e.fromHandle ?? h.from, toHandle: e.toHandle ?? h.to }
    })
  })
  if (!d.meta.proSeeded && !d.projects.some((p) => p.workspace === 'professional')) {
    d.projects.push(...proSeed())
    d.meta.proSeeded = true
  }
  return d
}
