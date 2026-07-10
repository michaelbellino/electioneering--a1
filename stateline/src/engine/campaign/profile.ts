/**
 * Derive a {@link CandidateProfile} (what the electorate sees) from a candidate's static attributes plus
 * the accumulated campaign effects in the ledger on a given day. This is where "name recognition" and
 * "favorability" actually come from: base values + summed ledger effects, saturated into valid ranges.
 */
import type { DayIndex } from '../core/calendar'
import { sumElectorateChannel, type ScheduledEffect } from '../core/ledger'
import { clamp, clamp01, type EntityId } from '../core/primitives'
import { groupUtility } from '../electorate/evaluate'
import { MODEL_WEIGHTS } from '../electorate/model'
import type { CandidateProfile, VoterGroup } from '../electorate/types'
import type { CandidateState } from './types'

/** Candidate quality as seen by voters, from attributes (minus scandal drag). */
export function valenceOf(c: CandidateState): number {
  return clamp01(
    0.3 +
      0.4 * c.attributes.charisma +
      0.3 * c.attributes.competence +
      0.1 * c.attributes.integrity -
      0.25 * c.scandalLoad,
  )
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

export interface TurnoutBoostOptions {
  /** Needed to resolve an Independent's favorable groups (see below). */
  readonly calibrationOffset?: number
  /**
   * Complacency: per-candidate drag (0..1) on that candidate's OWN mobilization — a runaway
   * leader's supporters stay home. Computed by the caller from current shares.
   */
  readonly complacency?: Readonly<Record<EntityId, number>>
}

/**
 * GOTV/turnout effects are targeted: you can only mobilize your own supporters, so a candidate's
 * ground game raises turnout in each group IN PROPORTION TO THEIR SUPPORT within it (the group's
 * awareness-gated softmax share). One rule for everyone — partisans emergently concentrate on
 * their party's groups, Independents mobilize wherever they've actually won people over, and in
 * same-party races (primaries) GOTV no longer leaks wholesale to your rival.
 * Negative enthusiasm (attack-ad suppression) subtracts: demoralized supporters stay home.
 * Returns a per-group additive turnout boost map for {@link evaluateElectorate}.
 */
export function deriveTurnoutBoostMap(
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
  jurisdictionId: EntityId,
  groups: readonly VoterGroup[],
  candidates: readonly CandidateProfile[],
  opts: TurnoutBoostOptions = {},
): Record<string, number> {
  const boost: Record<string, number> = {}
  // Within-group support shares (computed lazily once): share(g, c) over all candidates.
  let shares: Record<string, Record<EntityId, number>> | null = null
  const sharesOf = (): Record<string, Record<EntityId, number>> => {
    if (shares) return shares
    const offset = opts.calibrationOffset ?? 0
    const tau = MODEL_WEIGHTS.tau
    shares = {}
    for (const g of groups) {
      const raws = candidates.map((c) => c.awareness * Math.exp(groupUtility(g, c, offset) / tau))
      const total = raws.reduce((a, b) => a + b, 0)
      const row: Record<EntityId, number> = {}
      candidates.forEach((c, i) => {
        row[c.candidateId] = total > 0 ? (raws[i] as number) / total : 0
      })
      shares[g.id] = row
    }
    return shares
  }

  for (const cand of candidates) {
    const gotv = sumElectorateChannel(ledger, day, {
      jurisdictionId,
      candidateId: cand.candidateId,
      channel: 'turnout',
    })
    // Enthusiasm (M2): excitement turns out your own leaners — persuasion's separate currency.
    // It can go NEGATIVE (attack ads demoralize), suppressing the target's turnout instead.
    const enthusiasm = sumElectorateChannel(ledger, day, {
      jurisdictionId,
      candidateId: cand.candidateId,
      channel: 'enthusiasm',
    })
    let mag = gotv + enthusiasm * 0.4
    if (mag > 0) mag *= 1 - clamp01(opts.complacency?.[cand.candidateId] ?? 0)
    if (mag === 0) continue
    for (const g of groups) {
      const support = sharesOf()[g.id]?.[cand.candidateId] ?? 0
      if (support > 0) {
        boost[g.id] = (boost[g.id] ?? 0) + mag * support
      }
    }
  }
  return boost
}
