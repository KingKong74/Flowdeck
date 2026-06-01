import type { AppData, Project, Task } from '../types'
import { uid, NTYPE } from '../lib/helpers'

function mkTask(o: Omit<Partial<Task>, 'subs'> & { title: string; subs?: { t: string; d?: boolean }[] }): Task {
  return {
    id: uid(),
    status: o.status ?? 'backlog',
    sprintId: o.sprintId ?? null,
    prio: o.prio ?? 'med',
    title: o.title,
    subs: (o.subs ?? []).map((s) => ({ id: uid(), t: s.t, d: !!s.d })),
  }
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
      canvas: { nodes: [], edges: [] },
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
      canvas: { nodes: [], edges: [] },
    },
  ]
}

export function seed(): AppData {
  const s1 = uid(),
    s2 = uid(),
    n1 = uid(),
    n2 = uid(),
    n3 = uid(),
    n4 = uid()
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
              { t: 'Edit / delete', d: false },
            ],
          }),
          mkTask({
            title: 'Overview landing page',
            status: 'done',
            sprintId: s1,
            prio: 'med',
            subs: [
              { t: 'Project cards', d: true },
              { t: 'Workspace switcher', d: true },
            ],
          }),
          mkTask({ title: 'Cloud sync', status: 'backlog', sprintId: s2, prio: 'low' }),
        ],
        canvas: {
          nodes: [
            { id: n1, title: 'Core App', note: 'The shell everything hangs off', type: 'milestone', x: 360, y: 60, color: NTYPE.milestone },
            { id: n2, title: 'Board view', note: 'Agile kanban + sprints', type: 'feature', x: 120, y: 280, color: NTYPE.feature },
            { id: n3, title: 'Map view', note: 'Feature brainstorming canvas', type: 'feature', x: 420, y: 300, color: NTYPE.feature },
            { id: n4, title: 'Cloud sync?', note: 'Maybe Supabase later', type: 'idea', x: 720, y: 280, color: NTYPE.idea },
          ],
          edges: [
            { id: uid(), from: n1, to: n2 },
            { id: uid(), from: n1, to: n3 },
            { id: uid(), from: n3, to: n4 },
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

export function migrate(data: AppData): AppData {
  const d: AppData = { meta: data.meta ?? {}, projects: data.projects ?? [], backlog: data.backlog ?? [] }
  d.projects.forEach((p) => {
    if (!p.canvas) p.canvas = { nodes: [], edges: [] }
    if (!p.workspace) p.workspace = 'personal'
  })
  if (!d.meta.proSeeded && !d.projects.some((p) => p.workspace === 'professional')) {
    d.projects.push(...proSeed())
    d.meta.proSeeded = true
  }
  return d
}
