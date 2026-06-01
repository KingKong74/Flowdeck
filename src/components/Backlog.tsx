import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useApp } from '../store/AppContext'
import type { BacklogItem, BacklogStatus } from '../types'
import { BL } from '../lib/helpers'

export default function Backlog() {
  const { data, mutate, setModal } = useApp()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const col = e.over?.id as BacklogStatus | undefined
    const id = e.active.id as string
    if (!col) return
    mutate((d) => {
      const it = d.backlog.find((x) => x.id === id)
      if (it) it.status = col
    })
  }

  return (
    <div className="main">
      <div className="blwrap">
        <div className="blhead">
          <div>
            <h2>Personal Backlog</h2>
            <p>Life admin, side quests, the small stuff.</p>
          </div>
          <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setModal({ type: 'backlog' })}>
            + New item
          </button>
        </div>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="board">
            {BL.map((c) => (
              <Col key={c.id} id={c.id} nm={c.nm} tone={c.t} items={data.backlog.filter((i) => i.status === c.id)} />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}

function Col({ id, nm, tone, items }: { id: BacklogStatus; nm: string; tone: string; items: BacklogItem[] }) {
  const { setModal } = useApp()
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={'col' + (isOver ? ' drop' : '')}>
      <div className="chead">
        <span className="t" style={{ background: tone }} />
        <span className="nm">{nm}</span>
        <span className="ct">{items.length}</span>
      </div>
      <div className="cbody">
        {items.map((i) => (
          <Item key={i.id} item={i} />
        ))}
        <button className="addcard" onClick={() => setModal({ type: 'backlog', status: id })}>+ Add item</button>
      </div>
    </div>
  )
}

function Item({ item }: { item: BacklogItem }) {
  const { mutate, setModal } = useApp()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  const del = () => mutate((d) => (d.backlog = d.backlog.filter((x) => x.id !== item.id)))
  return (
    <div ref={setNodeRef} className={'card' + (isDragging ? ' dragging' : '')} style={style} {...listeners} {...attributes}>
      <div className="ctop">
        <span className="prio" style={{ background: '#0072f5' }} />
        <span className="ctitle">{item.title}</span>
      </div>
      <div className="meta">
        <span>#{item.cat || 'misc'}</span>
        <span className="r">
          <button className="mbtn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setModal({ type: 'backlog', id: item.id })}>✎</button>
          <button className="mbtn" onPointerDown={(e) => e.stopPropagation()} onClick={del}>×</button>
        </span>
      </div>
    </div>
  )
}
