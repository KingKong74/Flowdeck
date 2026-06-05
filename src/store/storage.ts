import type { AppData } from '../types'
import { supabase } from '../lib/supabase'

const LOCAL_KEY = 'flowdeck-data-v1'

/* ---- localStorage (fallback / offline) ---- */
export function loadLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}
export function saveLocal(d: AppData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d))
  } catch {
    /* quota / private mode */
  }
}

/* ---- Supabase: one JSONB row per user in `workspaces` ---- */
export async function loadRemote(userId: string): Promise<AppData | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('workspaces').select('data').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('Flowdeck load failed:', error.message)
    throw error
  }
  return (data?.data as AppData) ?? null
}
export async function saveRemote(userId: string, d: AppData): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('workspaces')
    .upsert({ user_id: userId, data: d, updated_at: new Date().toISOString() })
  if (error) console.error('Flowdeck save failed:', error.message)
}
