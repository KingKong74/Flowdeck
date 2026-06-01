import type { AppData } from '../types'

const KEY = 'flowdeck-data-v1'

/**
 * Persistence layer. Currently backed by localStorage.
 *
 * To move to Supabase later, swap the bodies of load()/save() for async
 * calls and make them return Promises (then await them in AppContext).
 * The rest of the app only touches these two functions, so nothing else
 * has to change. A sketch:
 *
 *   import { createClient } from '@supabase/supabase-js'
 *   const supabase = createClient(URL, ANON_KEY)
 *   export async function load(): Promise<AppData | null> {
 *     const { data } = await supabase.from('workspaces')
 *       .select('data').eq('user_id', userId).single()
 *     return data?.data ?? null
 *   }
 *   export async function save(d: AppData) {
 *     await supabase.from('workspaces')
 *       .upsert({ user_id: userId, data: d })
 *   }
 */

export function load(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}

export function save(d: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* quota / private-mode — ignore */
  }
}
