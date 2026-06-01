import { useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import { useApp } from '../store/AppContext'
import type { Project, CanvasNode, NodeType } from '../types'
import { NTYPE, uid } from '../lib/helpers'

type NData = { nid: string; pid: string }

const toRFNode = (n: CanvasNode, pid: string): Node => ({
  id: n.id,
  type: 'feature',
  position: { x: n.x, y: n.y },
  data: { nid: n.id, pid },
})

export default function FlowMap({ project }: { project: Project }) {
  return (
    <ReactFlowProvider>
      <Canvas project={project} />
    </ReactFlowProvider>
  )
}

const nodeTypes = { feature: FeatureNode }

function Canvas({ project }: { project: Project }) {
  const { mutate } = useApp()
  const rf = useReactFlow()

  const initialNodes = useMemo(() => project.canvas.nodes.map((n) => toRFNode(n, project.id)), [project.id])
  const initialEdges = useMemo<Edge[]>(
    () => project.canvas.edges.map((e) => ({ id: e.id, source: e.from, target: e.to })),
    [project.id],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    const exists = project.canvas.edges.some(
      (e) => (e.from === c.source && e.to === c.target) || (e.from === c.target && e.to === c.source),
    )
    if (exists) return
    const id = uid()
    setEdges((eds) => addEdge({ ...c, id }, eds))
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.edges.push({ id, from: c.source!, to: c.target! })
    })
  }

  const onNodeDragStop = (_: unknown, node: Node) => {
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      const n = pr.canvas.nodes.find((x) => x.id === node.id)
      if (n) {
        n.x = node.position.x
        n.y = node.position.y
      }
    })
  }

  const onNodesDelete = (deleted: Node[]) => {
    const ids = deleted.map((n) => n.id)
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.nodes = pr.canvas.nodes.filter((n) => !ids.includes(n.id))
      pr.canvas.edges = pr.canvas.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to))
    })
  }

  const onEdgesDelete = (deleted: Edge[]) => {
    const ids = deleted.map((e) => e.id)
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.edges = pr.canvas.edges.filter((e) => !ids.includes(e.id))
    })
  }

  const addNode = (type: NodeType) => {
    const pos = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: 260 })
    const node: CanvasNode = { id: uid(), title: 'New ' + type, note: '', type, x: pos.x, y: pos.y, color: NTYPE[type] }
    mutate((d) => {
      const pr = d.projects.find((p) => p.id === project.id)!
      pr.canvas.nodes.push(node)
    })
    setNodes((ns) => [...ns, toRFNode(node, project.id)])
  }

  return (
    <>
      <div className="maptools">
        <button className="btn primary sm" onClick={() => addNode('feature')}>+ Add feature</button>
        <button className="btn sm" onClick={() => addNode('idea')}>+ Idea</button>
        <span className="hint">drag a node to move · drag from a node's edge dot to connect · double-click a node to edit</span>
      </div>
      <div className="canvas-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#181818" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </>
  )
}

function FeatureNode({ data, selected }: NodeProps) {
  const { data: appData, setModal } = useApp()
  const rf = useReactFlow()
  const { nid, pid } = data as NData
  const proj = appData.projects.find((p) => p.id === pid)
  const n = proj?.canvas.nodes.find((x) => x.id === nid)
  if (!n) return null
  const color = n.color || NTYPE[n.type]
  return (
    <div className={'fnode' + (selected ? ' selected' : '')}>
      <Handle type="target" position={Position.Left} />
      <div className="fnode-bar" style={{ background: color }} />
      <div className="fnode-head">
        <span className="ntype" style={{ color }}>{n.type}</span>
        <span className="nacts">
          <button className="mbtn" onClick={() => setModal({ type: 'node', id: n.id })}>✎</button>
          <button className="mbtn" onClick={() => rf.deleteElements({ nodes: [{ id: n.id }] })}>×</button>
        </span>
      </div>
      <div className="fnode-title" onDoubleClick={() => setModal({ type: 'node', id: n.id })}>{n.title}</div>
      {n.note && <div className="fnode-note">{n.note}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
