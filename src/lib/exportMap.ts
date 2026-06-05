import type { Project, CanvasNode, NodeType } from '../types'
import { isBuildable } from './helpers'

const CAP: Record<NodeType, string> = {
  app: 'App',
  feature: 'Feature',
  component: 'Component',
  infrastructure: 'Infrastructure',
  view: 'View',
  data: 'Data',
  idea: 'Idea',
  fix: 'Fix',
}

/** Idea/fix-tagged nodes are the work to export. */
export function buildableNodes(p: Project): CanvasNode[] {
  return p.canvas.nodes.filter(isBuildable)
}

/** First connected node that isn't itself a build item — the "parent" context. */
function parentOf(p: Project, nodeId: string): CanvasNode | null {
  for (const e of p.canvas.edges) {
    const otherId = e.from === nodeId ? e.to : e.to === nodeId ? e.from : null
    if (!otherId) continue
    const other = p.canvas.nodes.find((n) => n.id === otherId)
    if (other && !isBuildable(other)) return other
  }
  return null
}

const line = (n: CanvasNode) => (n.note?.trim() ? n.note.trim() : n.title)

export function canvasToMarkdown(p: Project): string {
  const items = buildableNodes(p)
  if (!items.length) return 'No ideas or fixes tagged yet.'

  // group by parent node id (or 'none')
  const groups = new Map<string, { header: string; items: CanvasNode[] }>()
  items.forEach((n) => {
    const parent = parentOf(p, n.id)
    const key = parent ? parent.id : 'none'
    if (!groups.has(key)) groups.set(key, { header: parent ? `${CAP[parent.type]}: ${parent.title}` : 'General', items: [] })
    groups.get(key)!.items.push(n)
  })

  let out = ''
  for (const g of groups.values()) {
    out += `${g.header}\nFeatures:\n\n`
    g.items.forEach((n) => (out += `* ${line(n)}\n`))
    out += `\n`
  }
  return out.trim() + '\n'
}

export function canvasToJSON(p: Project) {
  return {
    project: p.name,
    items: buildableNodes(p).map((n) => {
      const parent = parentOf(p, n.id)
      return { text: line(n), tags: n.tags, type: n.type, under: parent?.title ?? null }
    }),
  }
}

export function canvasToPrompt(p: Project): string {
  return (
    `Here are the things I want to build in "${p.name}". Please turn each into a concrete ` +
    `implementation plan — steps, files/areas it touches, and anything to watch out for.\n\n` +
    canvasToMarkdown(p)
  )
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
