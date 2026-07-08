/**
 * Electorate types — the modelled voting population of one jurisdiction.
 *
 * An electorate is built once from real demographics (segment composition) × the calibrated voter
 * model, plus a fitted per-jurisdiction `calibrationOffset` so the modelled baseline reproduces the
 * jurisdiction's real recent lean. It is then a mostly-static substrate: per-candidate dynamics
 * (name recognition, favorability, mobilization) are supplied at evaluation time from the effects
 * ledger, keeping {@link evaluateElectorate} a pure, RNG-free function of its inputs.
 */
import type { EntityId, Signed1, Unit01 } from '../core/primitives'
import type { IssueId } from '../../data/schema'

export interface VoterGroup {
  /** Segment id (e.g. 'white_college'). */
  readonly id: string
  /** Share of the jurisdiction's CVAP (groups sum to ~1). */
  readonly weight: number
  /** Absolute citizen voting-age population in this group. */
  readonly cvap: number
  /** Net two-party lean of this group in THIS jurisdiction (segment lean, pre-offset). −1 R .. +1 D. */
  readonly partisanLean: Signed1
  readonly partisanStrength: Unit01
  readonly issuePositions: Readonly<Record<IssueId, Signed1>>
  /** Effective per-issue salience = segment salience × issue base salience. */
  readonly issueSalience: Readonly<Record<IssueId, number>>
  readonly turnoutPropensity: Unit01
}

export interface ElectorateState {
  readonly jurisdictionId: EntityId
  readonly cvap: number
  readonly groups: readonly VoterGroup[]
  /** Recent real turnout as a fraction of CVAP (the average group turnout calibrates to this). */
  readonly baselineTurnout: Unit01
  /** Fitted additive lean offset applied to every group so the baseline matches the real lean. */
  readonly calibrationOffset: Signed1
  /** Mean turnout propensity across groups (weighted), cached for turnout normalization. */
  readonly meanPropensity: number
}

export type Party = 'D' | 'R' | 'I'

/** Everything the vote model needs to know about a candidate at the moment of evaluation. */
export interface CandidateProfile {
  readonly candidateId: EntityId
  readonly party: Party
  readonly positions: Readonly<Record<IssueId, Signed1>>
  /** Perceived quality/competence/charisma, 0..1. Everyone prefers higher, all else equal. */
  readonly valence: Unit01
  readonly incumbent: boolean
  /** Share of the electorate that recognizes this candidate, 0..1 (from the ledger; gates their vote). */
  readonly awareness: Unit01
  /** Net favorability among those who know them, −1..+1 (from the ledger). */
  readonly favorability: Signed1
}

export interface EvaluateOptions {
  /** Optional per-group turnout boost (GOTV/mobilization), groupId -> additive Unit01. */
  readonly turnoutBoost?: Readonly<Record<string, number>>
  /** Softmax temperature; lower = sharper vote splits. Defaults to model. */
  readonly tau?: number
}

export interface ElectorateResult {
  /** candidateId -> raw modelled votes. */
  readonly votesByCandidate: Readonly<Record<EntityId, number>>
  /** candidateId -> two-/multi-way vote share (sums to 1 across candidates). */
  readonly sharesByCandidate: Readonly<Record<EntityId, number>>
  /** Total modelled votes cast. */
  readonly totalVotes: number
  /** Turnout as a fraction of CVAP. */
  readonly turnout: Unit01
}
