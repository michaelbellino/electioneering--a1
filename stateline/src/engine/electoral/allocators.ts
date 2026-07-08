/**
 * Seat-allocation strategies: convert a vote tally into winner(s) + margin. Pure functions so they are
 * trivially testable and deterministic. Ties are broken deterministically (optionally with a seeded rng
 * for realism) so election night is replayable.
 */
import type { EntityId } from '../core/primitives'
import type { Rng } from '../core/rng'
import { sum } from '../core/primitives'
import type { AllocationResult } from './types'

function sharesFromVotes(
  votesByCandidate: Readonly<Record<EntityId, number>>,
): Record<EntityId, number> {
  const total = sum(Object.values(votesByCandidate)) || 1
  const shares: Record<EntityId, number> = {}
  for (const [id, v] of Object.entries(votesByCandidate)) shares[id] = v / total
  return shares
}

export interface AllocateOptions {
  readonly turnout?: number
  /** Optional seeded rng for breaking exact ties (otherwise broken lexicographically by id). */
  readonly rng?: Rng
}

/** First-past-the-post: the single highest vote-getter wins. */
export function allocateFPTP(
  votesByCandidate: Readonly<Record<EntityId, number>>,
  opts: AllocateOptions = {},
): AllocationResult {
  const entries = Object.entries(votesByCandidate)
  const shares = sharesFromVotes(votesByCandidate)
  if (entries.length === 0) {
    return { winnerIds: [], votesByCandidate, sharesByCandidate: shares, turnout: opts.turnout ?? 0, margin: 0, status: 'tie_unresolved' }
  }

  // Sort by votes desc; ties by id asc for a stable, deterministic ordering.
  const ranked = [...entries].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
  const [topId, topVotes] = ranked[0] as [EntityId, number]
  const runnerUpVotes = ranked[1]?.[1] ?? 0

  // Detect an exact tie at the top.
  const tiedTop = ranked.filter(([, v]) => v === topVotes).map(([id]) => id)
  let winnerId = topId
  let status: AllocationResult['status'] = 'resolved'
  if (tiedTop.length > 1) {
    if (opts.rng) {
      winnerId = opts.rng.pick(tiedTop)
    } else {
      winnerId = tiedTop[0] as EntityId // lexicographically smallest id
    }
  }

  const total = sum(Object.values(votesByCandidate)) || 1
  const margin = (topVotes - runnerUpVotes) / total
  return {
    winnerIds: [winnerId],
    votesByCandidate,
    sharesByCandidate: shares,
    turnout: opts.turnout ?? 0,
    margin,
    status,
  }
}
