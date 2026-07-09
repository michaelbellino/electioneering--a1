/**
 * The scheduled-event queue: a serializable binary min-heap ordered by (day, priority, insertSeq).
 *
 * Events drive everything time-based — election day firing, a scheduled debate, a delayed scandal. The
 * queue is deterministic: events on the same day resolve by ascending `priority`, ties broken by
 * insertion order, so a replay always fires them identically regardless of insertion order.
 *
 * Cancellation is lazy: a cancelled id is remembered and skipped on pop (cheaper than heap removal).
 */
import type { DayIndex } from './calendar'
import type { EntityId } from './primitives'

export interface GameEvent<P = unknown> {
  readonly id: EntityId
  readonly day: DayIndex
  /** Lower fires earlier within the same day. */
  readonly priority: number
  readonly kind: string
  readonly payload: P
  /** Insertion order, assigned by {@link scheduleEvent}; final tie-breaker. */
  readonly insertSeq: number
}

export interface EventQueueState {
  readonly heap: readonly GameEvent[]
  readonly seq: number
  readonly cancelled: readonly EntityId[]
}

export function createEventQueue(): EventQueueState {
  return { heap: [], seq: 0, cancelled: [] }
}

function before(a: GameEvent, b: GameEvent): boolean {
  if (a.day !== b.day) return a.day < b.day
  if (a.priority !== b.priority) return a.priority < b.priority
  return a.insertSeq < b.insertSeq
}

function siftUp(heap: GameEvent[], i: number): void {
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (before(heap[i] as GameEvent, heap[parent] as GameEvent)) {
      ;[heap[i], heap[parent]] = [heap[parent] as GameEvent, heap[i] as GameEvent]
      i = parent
    } else break
  }
}

function siftDown(heap: GameEvent[], i: number): void {
  const n = heap.length
  for (;;) {
    const l = 2 * i + 1
    const r = 2 * i + 2
    let smallest = i
    if (l < n && before(heap[l] as GameEvent, heap[smallest] as GameEvent)) smallest = l
    if (r < n && before(heap[r] as GameEvent, heap[smallest] as GameEvent)) smallest = r
    if (smallest === i) break
    ;[heap[i], heap[smallest]] = [heap[smallest] as GameEvent, heap[i] as GameEvent]
    i = smallest
  }
}

export interface ScheduleSpec<P = unknown> {
  readonly day: DayIndex
  readonly kind: string
  readonly payload: P
  readonly priority?: number
  /** Optional explicit id (otherwise generated from kind+seq). */
  readonly id?: EntityId
}

export function scheduleEvent<P>(q: EventQueueState, spec: ScheduleSpec<P>): EventQueueState {
  const event: GameEvent<P> = {
    id: spec.id ?? `evt:${spec.kind}:${q.seq}`,
    day: spec.day,
    priority: spec.priority ?? 0,
    kind: spec.kind,
    payload: spec.payload,
    insertSeq: q.seq,
  }
  const heap = q.heap.slice() as GameEvent[]
  heap.push(event as GameEvent)
  siftUp(heap, heap.length - 1)
  return { heap, seq: q.seq + 1, cancelled: q.cancelled }
}

export function cancelEvent(q: EventQueueState, id: EntityId): EventQueueState {
  if (q.cancelled.includes(id)) return q
  return { ...q, cancelled: [...q.cancelled, id] }
}

function popRaw(heap: GameEvent[]): GameEvent | null {
  if (heap.length === 0) return null
  const top = heap[0] as GameEvent
  const last = heap.pop() as GameEvent
  if (heap.length > 0) {
    heap[0] = last
    siftDown(heap, 0)
  }
  return top
}

export function peek(q: EventQueueState): GameEvent | null {
  // Skip cancelled entries at the top conceptually; peek returns the first non-cancelled.
  const heap = q.heap.slice() as GameEvent[]
  for (;;) {
    const top = heap[0]
    if (!top) return null
    if (q.cancelled.includes(top.id)) {
      popRaw(heap)
      continue
    }
    return top
  }
}

/**
 * Pop every event whose day <= `throughDay`, in deterministic order, skipping cancelled ones.
 * Returns the due events and the new queue state.
 */
export function popDue(
  q: EventQueueState,
  throughDay: DayIndex,
): readonly [due: readonly GameEvent[], next: EventQueueState] {
  const heap = q.heap.slice() as GameEvent[]
  const cancelled = new Set(q.cancelled)
  const due: GameEvent[] = []
  for (;;) {
    const top = heap[0]
    if (!top || top.day > throughDay) break
    const ev = popRaw(heap)
    if (ev && !cancelled.has(ev.id)) due.push(ev)
  }
  // Drop any cancellations that referenced already-popped events to keep the list from growing forever.
  const remainingIds = new Set(heap.map((e) => e.id))
  const stillRelevant = q.cancelled.filter((id) => remainingIds.has(id))
  return [due, { heap, seq: q.seq, cancelled: stillRelevant }]
}

export function size(q: EventQueueState): number {
  const cancelled = new Set(q.cancelled)
  return q.heap.reduce((n, e) => n + (cancelled.has(e.id) ? 0 : 1), 0)
}
