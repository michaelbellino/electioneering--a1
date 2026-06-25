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
}

export function resolveElection(
  electorate: ElectorateState,
  candidates: readonly CandidateProfile[],
  method: ElectoralMethod,
  opts: ResolveOptions = {},
): AllocationResult {
  const evalResult = evaluateElectorate(electorate, candidates, { turnoutBoost: opts.turnoutBoost })
  // Round modelled votes to whole ballots.
  const votes: Record<EntityId, number> = {}
  for (const c of candidates) {
    votes[c.candidateId] = Math.round(evalResult.votesByCandidate[c.candidateId] ?? 0)
  }

  switch (method) {
    case 'fptp':
    default:
      // Other methods fall back to FPTP for the slice; extension point for two-round/RCV/EC.
      return allocateFPTP(votes, { turnout: evalResult.turnout, rng: opts.rng })
  }
}
