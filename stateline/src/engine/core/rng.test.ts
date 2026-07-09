import { describe, expect, it } from 'vitest'
import { createRng, forkRng, nextU32, Rng, type RngState } from './rng'

describe('rng — determinism', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    const seqA = Array.from({ length: 20 }, () => a.u32())
    const seqB = Array.from({ length: 20 }, () => b.u32())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, ((r) => () => r.u32())(new Rng(1)))
    const b = Array.from({ length: 10 }, ((r) => () => r.u32())(new Rng(2)))
    expect(a).not.toEqual(b)
  })

  it('has a frozen golden sequence (guards against accidental algorithm changes)', () => {
    const r = new Rng(12345)
    const got = Array.from({ length: 8 }, () => r.u32())
    // Golden values captured from the mulberry32+splitmix32 implementation. If this breaks, the RNG
    // algorithm changed and every saved game / replay is invalidated — change the data version too.
    expect(got).toEqual([
      739843950, 1189082928, 4280334484, 4160707172, 1919576849, 3703171909, 1364065821, 1694718571,
    ])
  })

  it('nextU32 is pure — it never mutates the input state', () => {
    const state: RngState = createRng(99)
    const snapshot = { ...state }
    nextU32(state)
    nextU32(state)
    expect(state).toEqual(snapshot)
  })
})

describe('rng — distributions', () => {
  it('float() stays in [0, 1)', () => {
    const r = new Rng(7)
    for (let i = 0; i < 10000; i++) {
      const f = r.float()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
    }
  })

  it('float() is roughly uniform (mean ~0.5)', () => {
    const r = new Rng(7)
    let sum = 0
    const n = 100000
    for (let i = 0; i < n; i++) sum += r.float()
    expect(sum / n).toBeCloseTo(0.5, 2)
  })

  it('int() respects inclusive bounds and covers them', () => {
    const r = new Rng(42)
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 8)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(8)
      seen.add(v)
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('normal() has approximately the requested mean and sd', () => {
    const r = new Rng(123)
    const n = 200000
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i++) {
      const x = r.normal(10, 2)
      sum += x
      sumSq += x * x
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    expect(mean).toBeCloseTo(10, 1)
    expect(Math.sqrt(variance)).toBeCloseTo(2, 1)
  })
})

describe('rng — forking / stream isolation', () => {
  it('fork does not advance the parent stream', () => {
    const parent = new Rng(555)
    const before = parent.snapshot
    parent.fork('child-a')
    parent.fork('child-b')
    expect(parent.snapshot).toEqual(before)
    // And the parent continues exactly as if no fork happened:
    const expected = new Rng(555).u32()
    expect(parent.u32()).toEqual(expected)
  })

  it('different salts yield independent streams', () => {
    const parent = new Rng(555)
    const a = parent.fork('events')
    const b = parent.fork('ai')
    const seqA = Array.from({ length: 10 }, () => a.u32())
    const seqB = Array.from({ length: 10 }, () => b.u32())
    expect(seqA).not.toEqual(seqB)
  })

  it('same salt from the same state yields the same stream', () => {
    const p1 = new Rng(555)
    const p2 = new Rng(555)
    const a = p1.fork('polling')
    const b = p2.fork('polling')
    expect(Array.from({ length: 10 }, () => a.u32())).toEqual(
      Array.from({ length: 10 }, () => b.u32()),
    )
  })

  it('draining a fork does not affect a sibling fork', () => {
    const parent = new Rng(555)
    const a = parent.fork('a')
    const b = parent.fork('b')
    const bFirst = b.u32()
    for (let i = 0; i < 1000; i++) a.u32() // drain a
    const bSecond = b.u32()
    // b's sequence is unaffected by a's consumption:
    const bRef = new Rng(forkRng(new Rng(555).snapshot, 'b'))
    expect(bFirst).toEqual(bRef.u32())
    expect(bSecond).toEqual(bRef.u32())
  })
})

describe('rng — serialization', () => {
  it('round-trips through its serializable state', () => {
    const r = new Rng(2024)
    for (let i = 0; i < 13; i++) r.u32() // advance to an arbitrary position
    const saved: RngState = r.snapshot
    const restored = new Rng(JSON.parse(JSON.stringify(saved)) as RngState)
    expect(Array.from({ length: 5 }, () => restored.u32())).toEqual(
      Array.from({ length: 5 }, () => r.u32()),
    )
  })
})
