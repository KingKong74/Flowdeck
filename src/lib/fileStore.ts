// File contents captured at import. Kept OUT of AppData so the autosave clone
// stays small and fast — persisted to its own localStorage key.
const KEY = 'flowdeck-files'

function load(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
let mem: Record<string, string> = load()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* quota — content stays in-memory for the session */ }
}

export function getFile(id: string): string | undefined {
  return mem[id]
}
export function hasFile(id: string): boolean {
  return id in mem
}
export function setFiles(entries: Record<string, string>) {
  Object.assign(mem, entries)
  persist()
}
