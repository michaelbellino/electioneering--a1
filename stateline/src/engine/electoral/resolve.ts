/**
 * Resolve an election: run the calibrated electorate to get true vote shares, scale to whole votes, and
 * allocate the seat. This is the deterministic election-night computation (one optional seeded draw for
 * tie-breaking), so a replay produces the same winner.
 */
import type { EntityId } from '../core/primitives'
import type { Rng } from '../core/rng'
import { evaluateElectorate } from '../electorate/evaluate'
import type { CandidateProfile, ElectorateState } from '../electorate/types'
import { allocateFPTP } from './allocators'
import type { AllocationResult, ElectoralMethod } from './types'

export interface ResolveOptions {
  /** Per-group turnout boost from GOTV/mobilization (groupId -> additive). */
  readonly turnoutBoost?: Readonly<Record<string, number>>
  /** Seeded rng for breaking an exact tie. */
  readonly rng?: Rng
  /**
   * SPATIAL resolution (M2): instead of one district-wide evaluation, sum the votes of each
   * community's own electorate with locally-adjusted candidate profiles (ground presence is real
   * votes). Supply the per-community electorates+profiles; district totals = the sum of places.
   */
  readonly communities?: ReadonlyArray<{
    readonly electorate: ElectorateState
    readonly profiles: readonly CandidateProfile[]
  }>
}

export function resolveElection(
  electorate: ElectorateState,
  candidates: readonly CandidateProfile[],
  method: ElectoralMethod,
  opts: ResolveOptions = {},
): AllocationResult {
  // Spatial mode: the district result IS the sum of its communities.
  let votesByCandidate: Record<EntityId, number> = {}
  let turnout: number
  if (opts.communities && opts.communities.length > 0) {
    let turnedOut = 0
    let cvap = 0
    for (const unit of opts.communities) {
      const local = evaluateElectorate(unit.electorate, unit.profiles, { turnoutBoost: opts.turnoutBoost })
      for (const [id, v] of Object.entries(local.votesByCandidate)) {
        votesByCandidate[id] = (votesByCandidate[id] ?? 0) + v
      }
      turnedOut += local.turnout * unit.electorate.cvap
      cvap += unit.electorate.cvap
    }
    turnout = cvap > 0 ? turnedOut / cvap : 0
  } else {
    const evalResult = evaluateElectorate(electorate, candidates, { turnoutBoost: opts.turnoutBoost })
    votesByCandidate = { ...evalResult.votesByCandidate }
    turnout = evalResult.turnout
  }
  // Round modelled votes to whole ballots.
  const votes: Record<EntityId, number> = {}
  for (const c of candidates) {
    votes[c.candidateId] = Math.round(votesByCandidate[c.candidateId] ?? 0)
  }

  switch (method) {
    case 'fptp':
    default:
      // Other methods fall back to FPTP for the slice; extension point for two-round/RCV/EC.
      return allocateFPTP(votes, { turnout, rng: opts.rng })
  }
}
