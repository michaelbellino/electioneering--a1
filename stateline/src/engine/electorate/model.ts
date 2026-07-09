/**
 * Tunable parameters of the vote-choice model. Isolated here so they can be swept/refit without
 * touching the evaluation logic, and so the calibration step has a single set of knobs to fit against.
 */
import { ISSUE_IDS, type IssueId } from '../../data/schema'
import { ISSUE_DEFS } from '../../data/voterModel'

export interface ModelWeights {
  /** Weight on issue-space proximity (spatial voting). */
  readonly spatial: number
  /** Weight on party identification × group lean. US voting is partisanship-dominant, so this is large. */
  readonly partisan: number
  /** Weight on candidate valence (quality/competence). */
  readonly valence: number
  /** Weight on net favorability. */
  readonly favorability: number
  /** Softmax temperature for vote choice; lower = sharper splits. */
  readonly tau: number
}

export const MODEL_WEIGHTS: ModelWeights = {
  spatial: 1.0,
  partisan: 2.6,
  valence: 0.9,
  favorability: 0.9,
  tau: 0.55,
}

/** Base salience per issue, taken from the voter model's issue definitions. */
export const ISSUE_BASE_SALIENCE: Readonly<Record<IssueId, number>> = Object.fromEntries(
  ISSUE_DEFS.map((d) => [d.id, d.baseSalience]),
) as Record<IssueId, number>

/**
 * Symmetric "generic" party platforms used ONLY to fit each jurisdiction's calibration offset. Real
 * candidates carry their own platforms. Symmetry means the spatial term cancels and the fitted offset
 * cleanly maps the partisan term onto the jurisdiction's known baseline share.
 */
export const GENERIC_D: Readonly<Record<IssueId, number>> = Object.fromEntries(
  ISSUE_IDS.map((id) => [id, 0.5]),
) as Record<IssueId, number>

export const GENERIC_R: Readonly<Record<IssueId, number>> = Object.fromEntries(
  ISSUE_IDS.map((id) => [id, -0.5]),
) as Record<IssueId, number>

/** Map a two-party lean (−1 R .. +1 D) to a target Democratic two-party vote share. */
export function leanToTargetDShare(lean: number): number {
  const s = 0.5 + 0.5 * lean
  return Math.min(0.98, Math.max(0.02, s))
}
