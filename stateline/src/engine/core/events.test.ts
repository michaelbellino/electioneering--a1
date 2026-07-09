import { describe, expect, it } from 'vitest'
import { cancelEvent, createEventQueue, popDue, peek, scheduleEvent, size } from './events'

describe('event queue', () => {
  it('pops in (day, priority, insertSeq) order regardless of insertion order', () => {
    let q = createEventQueue()
    q = scheduleEvent(q, { day: 10, kind: 'c', payload: null })
    q = scheduleEvent(q, { day: 5, kind: 'a', payload: null })
    q = scheduleEvent(q, { day: 10, kind: 'b', payload: null, priority: -1 })
    q = scheduleEvent(q, { day: 5, kind: 'a2', payload: null }) // same day+priority as 'a', later insert
    const [due] = popDue(q, 100)
    expect(due.map((e) => e.kind)).toEqual(['a', 'a2', 'b', 'c'])
  })

  it('only pops events due on or before the given day', () => {
    let q = createEventQueue()
    q = scheduleEvent(q, { day: 5, kind: 'soon', payload: null })
    q = scheduleEvent(q, { day: 50, kind: 'later', payload: null })
    const [due, next] = popDue(q, 10)
    expect(due.map((e) => e.kind)).toEqual(['soon'])
    expect(size(next)).toBe(1)
    expect(peek(next)?.kind).toBe('later')
  })

  it('respects cancellation (lazy skip)', () => {
    let q = createEventQueue()
    q = scheduleEvent(q, { day: 5, kind: 'keep', payload: null, id: 'k' })
    q = scheduleEvent(q, { day: 6, kind: 'drop', payload: null, id: 'd' })
    q = cancelEvent(q, 'd')
    const [due] = popDue(q, 100)
    expect(due.map((e) => e.kind)).toEqual(['keep'])
  })

  it('is pure — scheduling returns a new state', () => {
    const q0 = createEventQueue()
    const q1 = scheduleEvent(q0, { day: 1, kind: 'x', payload: null })
    expect(q0.heap.length).toBe(0)
    expect(q1.heap.length).toBe(1)
  })

  it('handles a large randomized insert/pop and stays sorted', () => {
    let q = createEventQueue()
    const days = [42, 1, 17, 17, 3, 99, 5, 5, 5, 60, 2]
    days.forEach((d, i) => (q = scheduleEvent(q, { day: d, kind: `e${i}`, payload: null })))
    const [due] = popDue(q, 1000)
    const popped = due.map((e) => e.day)
    expect(popped).toEqual([...popped].sort((a, b) => a - b))
    expect(popped.length).toBe(days.length)
  })
})
