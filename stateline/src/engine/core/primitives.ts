/**
 * Engine-wide primitive types and tiny helpers. This module has NO dependencies so every other module
 * can import it without risk of a cycle.
 */

/** A value constrained (by convention) to [0, 1]. */
export type Unit01 = number
/** A value constrained (by convention) to [-1, 1]. */
export type Signed1 = number
/** Integer cents. Money is ALWAYS integer cents in the engine — never floats — to avoid drift. */
export type Cents = number

/** A stable string identifier for an entity (jurisdiction, candidate, election, …). */
export type EntityId = string

export type GamePhase = 'menu' | 'setup' | 'campaign' | 'election_night' | 'governing' | 'ended'

export interface ActionMeta {
  readonly source: 'player' | 'event' | 'ai' | 'system'
  /** Tick at which the action was applied (for the log / replay). */
  readonly tick?: number
}

/**
 * The ONLY channel through which game state changes. Actions are serializable, namespaced by a `type`
 * prefix (`campaign/…`, `election/…`, `core/…`) and routed by the root reducer.
 */
export interface Action<T extends string = string, P = unknown> {
  readonly type: T
  readonly payload: P
  readonly meta?: ActionMeta
}

export interface LogEntry {
  readonly day: number
  readonly kind: string
  readonly message: string
  readonly data?: Readonly<Record<string, number | string | boolean>>
}

export const clamp = (x: number, min: number, max: number): number =>
  x < min ? min : x > max ? max : x

export const clamp01 = (x: number): Unit01 => clamp(x, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Numerically stable logistic / sigmoid. */
export const sigmoid = (x: number): number => {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

/** Softmax over a vector (temperature `tau` > 0; larger = flatter). Numerically stable. */
export const softmax = (xs: readonly number[], tau = 1): number[] => {
  if (xs.length === 0) return []
  const scaled = xs.map((x) => x / tau)
  const max = Math.max(...scaled)
  const exps = scaled.map((x) => Math.exp(x - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

/** Sum of an array of numbers. */
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

/** Format integer cents as USD for display. */
export const formatUsd = (cents: Cents): string => {
  const neg = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = abs % 100
  const grouped = dollars.toLocaleString('en-US')
  return `${neg ? '-' : ''}$${grouped}.${String(rem).padStart(2, '0')}`
}
