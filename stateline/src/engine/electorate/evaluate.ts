/**
 * The vote-choice + turnout model. PURE and RNG-FREE: the same electorate + candidates always produce
 * the same shares, which is what makes election night and "what-if" previews replayable. Randomness
 * (poll sampling, election-night draw) is layered on top elsewhere — never here.
 *
 * Model summary (per voter group g, candidate c):
 *   utility(g,c) = w_spatial · proximity(g,c)            // spatial/issue voting
 *                + w_partisan · strength_g · effLean_g · partyDir(c)   // partisanship (dominant)
 *                + w_valence  · valence_c                 // candidate quality
 *                + w_fav      · favorability_c            // net favorability
 * Vote probability within a group is an awareness-gated softmax over candidates; a candidate the group
 * has never heard of (awareness 0) cannot win its votes. Turnout per group scales the group's relative
 * propensity so the CVAP-weighted average matches the jurisdiction's calibrated baseline turnout.
 */
import { clamp, clamp01, sum, type EntityId } from '../core/primitives'
import { ISSUE_IDS } from '../../data/schema'
import { MODEL_WEIGHTS } from './model'
import type { CandidateProfile, ElectorateResult, ElectorateState, EvaluateOptions, VoterGroup } from './types'

function partyDir(party: CandidateProfile['party']): number {
  return party === 'D' ? 1 : party === 'R' ? -1 : 0
}

/** Utility a voter group assigns to a candidate (higher = more likely to vote for). */
export function groupUtility(
  group: VoterGroup,
  cand: CandidateProfile,
  calibrationOffset: number,
): number {
  const W = MODEL_WEIGHTS
  let wsum = 0
  let dist = 0
  for (const issue of ISSUE_IDS) {
    const s = group.issueSalience[issue]
    wsum += s
    const d = group.issuePositions[issue] - cand.positions[issue]
    dist += s * d * d
  }
  const proximity = wsum > 0 ? -(dist / wsum) : 0 // in [-4, 0]; 0 = perfect alignment
  const effLean = clamp(group.partisanLean + calibrationOffset, -1, 1)
  const partisan = group.partisanStrength * effLean * partyDir(cand.party)
  return (
    W.spatial * proximity +
    W.partisan * partisan +
    W.valence * cand.valence +
    W.favorability * cand.favorability
  )
}

/** Turnout fraction for a single group (relative propensity scaled to baseline, plus any boost). */
export function groupTurnout(
  group: VoterGroup,
  electorate: ElectorateState,
  boost = 0,
): number {
  const relative = electorate.meanPropensity > 0 ? group.turnoutPropensity / electorate.meanPropensity : 1
  return clamp01(electorate.baselineTurnout * relative + boost)
}

export function evaluateElectorate(
  electorate: ElectorateState,
  candidates: readonly CandidateProfile[],
  opts: EvaluateOptions = {},
): ElectorateResult {
  const tau = opts.tau ?? MODEL_WEIGHTS.tau
  const votes: Record<EntityId, number> = {}
  for (const c of candidates) votes[c.candidateId] = 0

  let turnedOut = 0
  for (const group of electorate.groups) {
    const boost = opts.turnoutBoost?.[group.id] ?? 0
    const turnout = groupTurnout(group, electorate, boost)
    const voters = group.cvap * turnout
    turnedOut += voters

    // Awareness-gated softmax over candidates.
    const raws = candidates.map(
      (c) => c.awareness * Math.exp(groupUtility(group, c, electorate.calibrationOffset) / tau),
    )
    const sumRaw = sum(raws)
    if (sumRaw <= 0) continue // group aware of nobody -> abstains in this race
    candidates.forEach((c, i) => {
      votes[c.candidateId] = (votes[c.candidateId] ?? 0) + voters * ((raws[i] as number) / sumRaw)
    })
  }

  const totalVotes = sum(Object.values(votes))
  const shares: Record<EntityId, number> = {}
  for (const c of candidates) {
    shares[c.candidateId] = totalVotes > 0 ? (votes[c.candidateId] ?? 0) / totalVotes : 0
  }

  return {
    votesByCandidate: votes,
    sharesByCandidate: shares,
    totalVotes,
    turnout: electorate.cvap > 0 ? turnedOut / electorate.cvap : 0,
  }
}
