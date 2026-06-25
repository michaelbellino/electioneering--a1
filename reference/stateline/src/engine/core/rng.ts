/**
 * Deterministic, serializable pseudo-random number generation.
 *
 * The whole simulation must be reproducible: the same seed + the same action log must replay to a
 * byte-identical state. That requires (a) a PRNG whose entire state is a small serializable value, and
 * (b) the ability to derive independent sub-streams ("forks") so that, e.g., the polling system drawing
 * random samples never perturbs the sequence the AI or event systems consume.
 *
 * Core algorithm: mulberry32 (fast, good statistical quality for a game, 32-bit serializable state).
 * Seeding/forking is mixed through splitmix32 so that small or adjacent seeds avalanche into very
 * different streams.
 *
 * NOTE: `Math.random()` and `Date.now()` are BANNED everywhere in the engine. All randomness flows
 * through this module so it stays replayable.
 */

/** The complete, serializable state of a stream. */
export interface RngState {
  /** 32-bit unsigned internal state. */
  readonly s: number
}

const U32 = 0x1_0000_0000 // 2^32

/** SplitMix32 finalizer — avalanches an integer so nearby seeds map to unrelated states. */
function splitmix32(input: number): number {
  let z = (input | 0) + 0x9e3779b9
  z = (z | 0) >>> 0
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0
  return (z ^ (z >>> 15)) >>> 0
}

/** FNV-1a hash of a string to a u32 — used to turn string salts into numeric fork offsets. */
function hashStringToU32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Create a fresh stream state from an integer seed. */
export function createRng(seed: number): RngState {
  return { s: splitmix32(Math.trunc(seed)) }
}

/**
 * Advance a stream by one step. Pure: returns the drawn u32 and the next state, never mutating input.
 * This is the canonical primitive; the {@link Rng} cursor is sugar over it.
 */
export function nextU32(state: RngState): readonly [value: number, next: RngState] {
  const a = (state.s + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = (t ^ (t >>> 14)) >>> 0
  return [value, { s: a >>> 0 }]
}

/**
 * Derive an independent sub-stream from a state + a salt WITHOUT consuming the parent.
 * Forking by a stable salt (e.g. `poll:${electionId}:${day}`) keeps systems isolated and replayable.
 */
export function forkRng(state: RngState, salt: string | number): RngState {
  const saltHash = typeof salt === 'number' ? splitmix32(Math.trunc(salt)) : hashStringToU32(salt)
  return { s: splitmix32((state.s ^ saltHash) >>> 0) }
}

/**
 * A mutable cursor over an {@link RngState}. Convenient for a sequence of draws within one pure
 * function; serialize via {@link Rng.snapshot}. Holds no hidden global state.
 */
export class Rng {
  private state: RngState

  constructor(stateOrSeed: RngState | number) {
    this.state = typeof stateOrSeed === 'number' ? createRng(stateOrSeed) : stateOrSeed
  }

  /** The current serializable state (use to persist / resume the exact stream position). */
  get snapshot(): RngState {
    return this.state
  }

  /** Next 32-bit unsigned integer. */
  u32(): number {
    const [value, next] = nextU32(this.state)
    this.state = next
    return value
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.u32() / U32
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min)
  }

  /** Uniform integer in [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1
    return minInclusive + Math.floor(this.float() * span)
  }

  /** Bernoulli draw with probability `p` of `true`. */
  bool(p = 0.5): boolean {
    return this.float() < p
  }

  /** Standard normal via Box–Muller (one of the pair). */
  normal(mean = 0, sd = 1): number {
    const u1 = Math.max(this.float(), Number.EPSILON)
    const u2 = this.float()
    const mag = Math.sqrt(-2 * Math.log(u1))
    return mean + sd * mag * Math.cos(2 * Math.PI * u2)
  }

  /** Uniformly pick an element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array')
    return arr[this.int(0, arr.length - 1)] as T
  }

  /** A new independent cursor derived from this one's current state + salt (does not advance this). */
  fork(salt: string | number): Rng {
    return new Rng(forkRng(this.state, salt))
  }
}
