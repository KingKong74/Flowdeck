import type { Canvas, CanvasNode, CanvasEdge, NodeType } from '../types'
import { uid, NTYPE, bestHandles } from './helpers'

const IGNORE_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.vite', '.turbo', '.cache', '.parcel-cache',
  'coverage', 'out', 'vendor', '.idea', '.vscode', 'tmp', 'temp', '.expo', '.svelte-kit', 'target', 'bin', 'obj',
])
const ignoreFile = (name: string) =>
  /^\.ds_store$/i.test(name) || /\.(lock|log|map)$/i.test(name) || /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(name)

const TEXT_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'css', 'scss', 'sass', 'less', 'styl',
  'json', 'yml', 'yaml', 'toml', 'ini', 'env', 'conf', 'md', 'mdx', 'txt', 'rst', 'html', 'htm',
  'sql', 'prisma', 'graphql', 'gql', 'sh', 'bash', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'php', 'c', 'h', 'cpp', 'cs', 'xml', 'svg',
])
const extOf = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
const isText = (name: string) => TEXT_EXT.has(extOf(name))
const MAX_FILE_BYTES = 80 * 1024
const SNIPPET = 8000
const TOTAL_CAP = 1_400_000

const MAX_DEPTH = 4
const MAX_NODES = 250
const FILE_CAP = 30

function folderType(name: string): NodeType {
  const n = name.toLowerCase()
  if (/^(components?|ui|widgets|elements)$/.test(n)) return 'component'
  if (/^(pages?|views?|screens?|routes?|app)$/.test(n)) return 'view'
  if (/^(api|server|backend|services?|functions?|controllers?|middleware|handlers?|graphql)$/.test(n)) return 'service'
  if (/^(db|database|models?|schema|migrations?|prisma|entities|data|stores?|supabase)$/.test(n)) return 'data'
  if (/^(tests?|__tests__|specs?|e2e|cypress|__mocks__|playwright)$/.test(n)) return 'test'
  if (/^(docs?|documentation)$/.test(n)) return 'docs'
  if (/^(config|configs|scripts?|build|ci|deploy|infra|infrastructure|\.github|docker|terraform|k8s)$/.test(n)) return 'config'
  if (/^(hooks?|utils?|libs?|helpers?|shared|common|core|context|providers?|store)$/.test(n)) return 'module'
  if (/^(assets?|public|static|images?|img|fonts?|media|styles?|css|scss|theme)$/.test(n)) return 'module'
  return 'module'
}
function fileType(name: string): NodeType {
  const base = name.toLowerCase()
  const ext = extOf(base)
  if (/\.(test|spec)\.[a-z0-9]+$/.test(base)) return 'test'
  if (/(^|\.)config\.[a-z0-9]+$/.test(base) || /^(package\.json|tsconfig.*\.json|dockerfile|makefile|\.env.*)$/.test(base)) return 'config'
  if (['tsx', 'jsx', 'vue', 'svelte'].includes(ext)) return 'component'
  if (['html', 'htm'].includes(ext)) return 'view'
  if (['sql', 'prisma', 'graphql', 'gql'].includes(ext)) return 'data'
  if (['json', 'yml', 'yaml', 'toml', 'ini', 'env', 'conf'].includes(ext)) return 'config'
  if (['md', 'mdx', 'txt', 'rst'].includes(ext)) return 'docs'
  return 'module'
}

interface Folder { path: string; name: string; depth: number; parent: string | null }
interface FileRec { name: string; depth: number; parent: string; path: string }
type Cand = { kind: 'folder' | 'file'; path: string; name: string; depth: number; parent: string | null }

export interface ImportResult { name: string; canvas: Canvas; nodeCount: number; fileCount: number }

export function buildCanvasFromPaths(paths: string[], opts: { rootAsApp?: boolean } = {}): ImportResult {
  const rootAsApp = opts.rootAsApp !== false
  const folders = new Map<string, Folder>()
  const filesByParent = new Map<string, FileRec[]>()
  let fileCount = 0
  let rootName = 'Project'

  const ensure = (segs: string[]) => {
    for (let i = 0; i < segs.length; i++) {
      const path = segs.slice(0, i + 1).join('/')
      if (!folders.has(path)) folders.set(path, { path, name: segs[i], depth: i, parent: i ? segs.slice(0, i).join('/') : null })
    }
  }
  for (const raw of paths) {
    const segs = raw.replace(/^[./]+/, '').split('/').filter(Boolean)
    if (!segs.length) continue
    if (segs.some((s) => IGNORE_DIR.has(s))) continue
    const file = segs[segs.length - 1]
    if (ignoreFile(file)) continue
    rootName = segs[0]
    const dirs = segs.slice(0, -1)
    ensure(dirs.length ? dirs : [segs[0]])
    const parent = dirs.length ? dirs.join('/') : segs[0]
    fileCount++
    if (!filesByParent.has(parent)) filesByParent.set(parent, [])
    filesByParent.get(parent)!.push({ name: file, depth: dirs.length, parent, path: parent + '/' + file })
  }

  const cands: Cand[] = [...folders.values()].map((f) => ({ kind: 'folder', path: f.path, name: f.name, depth: f.depth, parent: f.parent }))
  const extra = new Map<string, number>()
  for (const [parent, list] of filesByParent) {
    list.sort((a, b) => a.name.localeCompare(b.name))
    if (list.length > FILE_CAP) extra.set(parent, list.length - FILE_CAP)
    list.slice(0, FILE_CAP).forEach((f) => cands.push({ kind: 'file', path: f.path, name: f.name, depth: f.depth, parent: f.parent }))
  }

  const chosen = cands
    .filter((c) => c.depth <= MAX_DEPTH)
    .sort((a, b) => a.depth - b.depth || (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1))
    .slice(0, MAX_NODES)
  const idOf = new Map<string, string>()
  chosen.forEach((c) => idOf.set(c.path, uid()))
  const chosenIds = new Set(chosen.map((c) => c.path))

  const folderNote = (path: string) => {
    const list = filesByParent.get(path) || []
    if (!list.length) return ''
    const exts = new Map<string, number>()
    list.forEach((f) => { const e = extOf(f.name); if (e) exts.set(e, (exts.get(e) || 0) + 1) })
    const top = [...exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, c]) => `${c} .${e}`)
    const more = extra.get(path)
    return [`${list.length} file${list.length > 1 ? 's' : ''}`, top.join(', '), more ? `(+${more} more)` : ''].filter(Boolean).join(' · ')
  }

  const nodes: CanvasNode[] = chosen.map((c) => {
    let type: NodeType
    if (c.kind === 'folder') type = c.depth === 0 && c.path === rootName && rootAsApp ? 'app' : c.depth === 0 ? 'module' : folderType(c.name)
    else type = fileType(c.name)
    return { id: idOf.get(c.path)!, title: c.name, note: c.kind === 'folder' ? folderNote(c.path) : '', type, tags: [], x: 0, y: 0, color: NTYPE[type], path: c.path }
  })
  const edges: CanvasEdge[] = []
  chosen.forEach((c) => {
    if (c.parent && chosenIds.has(c.parent)) edges.push({ id: uid(), from: idOf.get(c.parent)!, to: idOf.get(c.path)! })
  })

  layout(nodes, edges)
  return { name: rootName, canvas: { nodes, edges }, nodeCount: nodes.length, fileCount }
}

// left-to-right tidy tree: x by depth, y spread across leaves
function layout(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const COLW = 300
  const ROWH = 92
  const kids = new Map<string, string[]>()
  const hasParent = new Set<string>()
  edges.forEach((e) => { if (!kids.has(e.from)) kids.set(e.from, []); kids.get(e.from)!.push(e.to); hasParent.add(e.to) })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depth = new Map<string, number>()
  const sortKids = (ids: string[]) =>
    ids.slice().sort((a, b) => {
      const ca = (kids.get(a)?.length || 0) > 0, cb = (kids.get(b)?.length || 0) > 0
      if (ca !== cb) return ca ? -1 : 1
      return (byId.get(a)?.title || '').localeCompare(byId.get(b)?.title || '')
    })
  let row = 0
  const place = (id: string, d: number) => {
    if (depth.has(id)) return
    depth.set(id, d)
    const cs = sortKids(kids.get(id) || [])
    if (!cs.length) { byId.get(id)!.y = row * ROWH; row++; return }
    cs.forEach((c) => place(c, d + 1))
    const ys = cs.map((c) => byId.get(c)!.y)
    byId.get(id)!.y = (Math.min(...ys) + Math.max(...ys)) / 2
  }
  nodes.filter((n) => !hasParent.has(n.id)).forEach((r) => place(r.id, 0))
  nodes.forEach((n) => { if (!depth.has(n.id)) place(n.id, 0) })
  nodes.forEach((n) => (n.x = (depth.get(n.id) || 0) * COLW + 40))
  edges.forEach((e) => {
    const a = byId.get(e.from), b = byId.get(e.to)
    if (!a || !b) return
    const h = bestHandles(a, b)
    e.fromHandle = h.from
    e.toHandle = h.to
  })
}

// ---- folder reading (paths + capped text contents) ----
export function pathsFromFileList(files: FileList | File[]): string[] {
  return Array.from(files).map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name)
}

export async function readContents(files: FileList | File[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  let total = 0
  for (const f of Array.from(files)) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (path.split('/').some((s) => IGNORE_DIR.has(s))) continue
    const name = path.split('/').pop() || ''
    if (!isText(name) || f.size > MAX_FILE_BYTES || total > TOTAL_CAP) continue
    try { const t = (await f.text()).slice(0, SNIPPET); out[path] = t; total += t.length } catch { /* skip */ }
  }
  return out
}

export async function readDrop(items: DataTransferItem[]): Promise<{ paths: string[]; contents: Record<string, string> }> {
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  const paths: string[] = []
  const contents: Record<string, string> = {}
  let total = 0
  const fileOf = (fe: FileSystemFileEntry) => new Promise<File>((res, rej) => fe.file(res, rej))
  const readDir = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
    new Promise((res) => reader.readEntries((e) => res(e), () => res([])))
  const walk = async (entry: FileSystemEntry, prefix: string) => {
    const full = prefix + entry.name
    if (entry.isFile) {
      paths.push(full)
      if (isText(entry.name) && total < TOTAL_CAP) {
        try {
          const f = await fileOf(entry as FileSystemFileEntry)
          if (f.size <= MAX_FILE_BYTES) { const t = (await f.text()).slice(0, SNIPPET); contents[full] = t; total += t.length }
        } catch { /* skip */ }
      }
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    let batch = await readDir(reader)
    while (batch.length) { for (const e of batch) await walk(e, full + '/'); batch = await readDir(reader) }
  }
  for (const e of entries) await walk(e, '')
  return { paths, contents }
}
