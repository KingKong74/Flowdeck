import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppData, Project, WorkspaceKind, Status } from '../types'
import { hasSupabase, supabase } from '../lib/supabase'
import { loadLocal, saveLocal, loadRemote, saveRemote } from './storage'
import { seed, migrate } from './seed'

type Mode = 'overview' | 'project' | 'backlog' | 'settings'
type Tab = 'board' | 'map' | 'tree'
type View = 'grid' | 'list'
type AppStatus = 'loading' | 'auth' | 'ready'
type Theme = 'dark' | 'light'

const EMPTY: AppData = { meta: {}, projects: [], backlog: [] }

export interface UIState {
  mode: Mode
  workspace: WorkspaceKind
  view: View
  search: string
  activeProjectId: string | null
  activeSprint: string
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
  | { type: 'sync' }
  | { type: 'help' }
  | { type: 'import'; target?: string }
  | { type: 'explain'; id: string }

interface Ctx {
  data: AppData
  mutate: (fn: (d: AppData) => void) => void
  ui: UIState
  setUI: (patch: Partial<UIState>) => void
  modal: Modal
  setModal: (m: Modal) => void
  status: AppStatus
  authEnabled: boolean
  userEmail: string | null
  signOut: () => void
  theme: Theme
  setTheme: (t: Theme) => void
  wsProjects: () => Project[]
  activeProject: () => Project | null
  openProject: (id: string) => void
  goOverview: () => void
  setWorkspace: (ws: WorkspaceKind) => void
  toggleCard: (id: string) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY)
  const [status, setStatus] = useState<AppStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState<boolean>(!hasSupabase)
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
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('flowdeck-theme') as Theme) || 'dark',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('flowdeck-theme', theme)
  }, [theme])
  const setTheme = (t: Theme) => setThemeState(t)

  const skipNextSave = useRef(true)
  const saveTimer = useRef<number | undefined>(undefined)

  // bootstrap: local mode loads immediately; supabase mode waits for a session
  useEffect(() => {
    if (!hasSupabase) {
      const existing = loadLocal()
      const d = existing ? migrate(existing) : seed()
      if (!existing) saveLocal(d)
      setData(d)
      setStatus('ready')
      return
    }
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuthReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // load (or seed) the user's data once we know the session
  useEffect(() => {
    if (!hasSupabase || !authReady) return
    if (!session) {
      setData(EMPTY)
      setStatus('auth')
      return
    }
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      let existing: AppData | null = null
      try {
        existing = await loadRemote(session.user.id)
      } catch {
        /* surfaced in console; fall back to a fresh seed */
      }
      const d = existing ? migrate(existing) : seed()
      if (!existing) {
        try {
          await saveRemote(session.user.id, d)
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) {
        skipNextSave.current = true
        setData(d)
        setStatus('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, authReady])

  // debounced persist on every change (skips the freshly-loaded snapshot)
  useEffect(() => {
    if (status !== 'ready') return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      if (hasSupabase && session) saveRemote(session.user.id, data)
      else if (!hasSupabase) saveLocal(data)
    }, 600)
  }, [data, status]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const signOut = () => {
    supabase?.auth.signOut()
  }

  const value: Ctx = {
    data,
    mutate,
    ui,
    setUI,
    modal,
    setModal,
    status,
    authEnabled: hasSupabase,
    userEmail: session?.user.email ?? null,
    signOut,
    theme,
    setTheme,
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
