export type WorkspaceKind = 'personal' | 'professional'
export type Status = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'
export type Priority = 'high' | 'med' | 'low'
export type SprintStatus = 'planned' | 'active' | 'done'
export type NodeType = 'feature' | 'idea' | 'milestone' | 'risk'
export type BacklogStatus = 'todo' | 'doing' | 'done'

export interface SubTask {
  id: string
  t: string
  d: boolean
}

export interface Task {
  id: string
  title: string
  status: Status
  sprintId: string | null
  prio: Priority
  subs: SubTask[]
}

export interface Sprint {
  id: string
  name: string
  goal: string
  status: SprintStatus
}

export interface CanvasNode {
  id: string
  title: string
  note: string
  type: NodeType
  x: number
  y: number
  color: string
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
}

export interface Canvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface Project {
  id: string
  name: string
  desc?: string
  color: string
  workspace: WorkspaceKind
  client?: string
  domain?: string
  sprints: Sprint[]
  tasks: Task[]
  canvas: Canvas
}

export interface BacklogItem {
  id: string
  title: string
  cat: string
  status: BacklogStatus
}

export interface AppData {
  meta: { proSeeded?: boolean }
  projects: Project[]
  backlog: BacklogItem[]
}
