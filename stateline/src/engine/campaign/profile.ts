/**
 * Derive a {@link CandidateProfile} (what the electorate sees) from a candidate's static attributes plus
 * the accumulated campaign effects in the ledger on a given day. This is where "name recognition" and
 * "favorability" actually come from: base values + summed ledger effects, saturated into valid ranges.
 */
import type { DayIndex } from '../core/calendar'
import { sumElectorateChannel, type ScheduledEffect } from '../core/ledger'
import { clamp, clamp01, type EntityId } from '../core/primitives'
import type { CandidateProfile } from '../electorate/types'
import type { CandidateAttributes, CandidateState } from './types'

/**
 * Candidate quality as seen by voters, computed straight from attributes (minus scandal drag).
 * Pure and dependency-light so the candidate-creator UI can preview the exact same number the
 * electorate will use — no duplicated formula. Charisma dominates (0.4), then competence (0.3),
 * then integrity (0.1); floor 0.3, saturates at 1.
 */
export function valenceFrom(attributes: CandidateAttributes, scandalLoad = 0): number {
  return clamp01(
    0.3 +
      0.4 * attributes.charisma +
      0.3 * attributes.competence +
      0.1 * attributes.integrity -
      0.25 * scandalLoad,
  )
}

/** Candidate quality as seen by voters, from attributes (minus scandal drag). */
export function valenceOf(c: CandidateState): number {
  return valenceFrom(c.attributes, c.scandalLoad)
}

export function deriveCandidateProfile(
  candidate: CandidateState,
  jurisdictionId: EntityId,
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
  opts: { incumbent?: boolean } = {},
): CandidateProfile {
  const exposure =
    candidate.baseExposure +
    sumElectorateChannel(ledger, day, {
      jurisdictionId,
      candidateId: candidate.id,
      channel: 'nameRecognition',
    })
  // Awareness saturates toward 1: each additional exposure point adds less (diminishing returns).
  const awareness = clamp01(1 - Math.exp(-Math.max(0, exposure)))

  const favRaw =
    candidate.baseFavorability +
    sumElectorateChannel(ledger, day, {
      jurisdictionId,
      candidateId: candidate.id,
      channel: 'favorability',
    }) -
    candidate.scandalLoad * 0.3

  return {
    candidateId: candidate.id,
    party: candidate.party,
    positions: candidate.positions,
    valence: valenceOf(candidate),
    incumbent: opts.incumbent ?? false,
    awareness,
    favorability: clamp(favRaw, -1, 1),
  }
}

function partyDir(party: CandidateProfile['party']): number {
  return party === 'D' ? 1 : party === 'R' ? -1 : 0
}

/**
 * GOTV/turnout effects are targeted: a candidate's ground game boosts turnout among groups that lean
 * their way. Returns a per-group additive turnout boost map for {@link evaluateElectorate}.
 */
export function deriveTurnoutBoostMap(
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
  jurisdictionId: EntityId,
  groups: readonly { id: string; partisanLean: number }[],
  candidates: readonly { candidateId: EntityId; party: CandidateProfile['party'] }[],
): Record<string, number> {
  const boost: Record<string, number> = {}
  for (const cand of candidates) {
    const mag = sumElectorateChannel(ledger, day, {
      jurisdictionId,
      candidateId: cand.candidateId,
      channel: 'turnout',
    })
    if (mag <= 0) continue
    const dir = partyDir(cand.party)
    for (const g of groups) {
      // Boost groups that lean toward this candidate (same sign of lean as the candidate's party).
      if (dir !== 0 && Math.sign(g.partisanLean) === dir) {
        boost[g.id] = (boost[g.id] ?? 0) + mag
      }
    }
  }
  return boost
}
