import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppData, Project, WorkspaceKind, Status } from '../types'
import { load, save } from './storage'
import { seed, migrate } from './seed'

type Mode = 'overview' | 'project' | 'backlog'
type Tab = 'board' | 'map'
type View = 'grid' | 'list'

export interface UIState {
  mode: Mode
  workspace: WorkspaceKind
  view: View
  search: string
  activeProjectId: string | null
  activeSprint: string // 'all' | 'backlog' | sprintId
  projectTab: Tab
  openCards: string[]
}

export type Modal =
  | { type: null }
  | { type: 'project'; id?: string }
  | { type: 'sprint' }
  | { type: 'task'; id?: string; status?: Status }
  | { type: 'node'; id: string }
  | { type: 'backlog'; id?: string; status?: string }

interface Ctx {
  data: AppData
  mutate: (fn: (d: AppData) => void) => void
  ui: UIState
  setUI: (patch: Partial<UIState>) => void
  modal: Modal
  setModal: (m: Modal) => void
  // convenience
  wsProjects: () => Project[]
  activeProject: () => Project | null
  openProject: (id: string) => void
  goOverview: () => void
  setWorkspace: (ws: WorkspaceKind) => void
  toggleCard: (id: string) => void
}

const AppCtx = createContext<Ctx | null>(null)

function init(): AppData {
  const existing = load()
  if (existing) return migrate(existing)
  const s = seed()
  save(s)
  return s
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(init)
  const [ui, setUIState] = useState<UIState>({
    mode: 'overview',
    workspace: 'personal',
    view: 'grid',
    search: '',
    activeProjectId: null,
    activeSprint: 'all',
    projectTab: 'board',
    openCards: [],
  })
  const [modal, setModal] = useState<Modal>({ type: null })

  // persist whenever data changes (skip the very first render)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    save(data)
  }, [data])

  const mutate = (fn: (d: AppData) => void) =>
    setData((prev) => {
      const next: AppData = structuredClone(prev)
      fn(next)
      return next
    })

  const setUI = (patch: Partial<UIState>) => setUIState((p) => ({ ...p, ...patch }))

  const wsProjects = () => data.projects.filter((p) => p.workspace === ui.workspace)
  const activeProject = () => data.projects.find((p) => p.id === ui.activeProjectId) ?? null

  const openProject = (id: string) =>
    setUI({ mode: 'project', activeProjectId: id, projectTab: 'board', activeSprint: 'all' })
  const goOverview = () => setUI({ mode: 'overview', activeProjectId: null })
  const setWorkspace = (ws: WorkspaceKind) =>
    setUI({ workspace: ws, mode: 'overview', activeProjectId: null, search: '' })
  const toggleCard = (id: string) =>
    setUIState((p) => ({
      ...p,
      openCards: p.openCards.includes(id) ? p.openCards.filter((x) => x !== id) : [...p.openCards, id],
    }))

  const value: Ctx = {
    data,
    mutate,
    ui,
    setUI,
    modal,
    setModal,
    wsProjects,
    activeProject,
    openProject,
    goOverview,
    setWorkspace,
    toggleCard,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}
