/**
 * Polling: a NOISY, sampled estimate of the true underlying preference.
 *
 * The true shares come from the deterministic {@link evaluateElectorate}. A poll perturbs them with
 * sampling error (and an optional pollster "house effect" bias), drawing from a FORKED rng stream so
 * polling never disturbs other systems. This is the only place election-prediction randomness lives;
 * the model itself stays deterministic so previews are stable.
 */
import type { Rng } from '../core/rng'
import type { EntityId } from '../core/primitives'
import { clamp01, sum } from '../core/primitives'
import { evaluateElectorate } from './evaluate'
import type { CandidateProfile, ElectorateState } from './types'

export interface Poll {
  readonly sampleSize: number
  /** 95% margin of error for a 50% proportion, in share points (e.g. 0.04 = ±4pts). */
  readonly marginOfError: number
  /** candidateId -> reported share (sums to 1). */
  readonly shares: Readonly<Record<EntityId, number>>
  /** The pollster's systematic bias toward candidates, if any (for flavor / "skewed polls"). */
  readonly houseEffect: number
}

export interface PollOptions {
  readonly sampleSize?: number
  /** Per-candidate additive house effect (bias), candidateId -> share points. */
  readonly houseEffects?: Readonly<Record<EntityId, number>>
}

/** 95% margin of error for a proportion near 0.5 at the given sample size. */
export function marginOfError(sampleSize: number): number {
  if (sampleSize <= 0) return 1
  return 1.96 * Math.sqrt(0.25 / sampleSize)
}

export function conductPoll(
  electorate: ElectorateState,
  candidates: readonly CandidateProfile[],
  rng: Rng,
  opts: PollOptions = {},
): Poll {
  const sampleSize = opts.sampleSize ?? 600
  const truth = evaluateElectorate(electorate, candidates)
  const noisy: Record<EntityId, number> = {}
  for (const c of candidates) {
    const p = truth.sharesByCandidate[c.candidateId] ?? 0
    const se = Math.sqrt(Math.max(p * (1 - p), 1e-6) / sampleSize)
    const house = opts.houseEffects?.[c.candidateId] ?? 0
    noisy[c.candidateId] = Math.max(0, p + rng.normal(0, se) + house)
  }
  const total = sum(Object.values(noisy)) || 1
  const shares: Record<EntityId, number> = {}
  for (const c of candidates) shares[c.candidateId] = clamp01((noisy[c.candidateId] ?? 0) / total)

  const houseMagnitude = opts.houseEffects
    ? sum(Object.values(opts.houseEffects).map(Math.abs))
    : 0
  return { sampleSize, marginOfError: marginOfError(sampleSize), shares, houseEffect: houseMagnitude }
}
