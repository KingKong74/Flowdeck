import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both env vars are set. When false, the app falls back to localStorage. */
export const hasSupabase = Boolean(url && key)

export const supabase = hasSupabase ? createClient(url!, key!) : null
