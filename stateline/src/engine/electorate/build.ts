/**
 * Build an {@link ElectorateState} from real demographics × the calibrated voter model.
 *
 * The key step is fitting `calibrationOffset`: we run the vote model with two symmetric "generic" party
 * candidates and bisect the offset until the modelled Democratic two-party share equals the
 * jurisdiction's real recent lean. After this, the modelled baseline reproduces reality, and any
 * deviation during play (better candidate, campaign effects, demographic change) is the simulation
 * doing its job. This is the "calibrate models to real, verifiable data" requirement, made testable.
 */
import type { JurisdictionDemographics, IssueId, VoterModel } from '../../data/schema'
import { ISSUE_IDS } from '../../data/schema'
import { ISSUE_BASE_SALIENCE, GENERIC_D, GENERIC_R, leanToTargetDShare } from './model'
import { evaluateElectorate } from './evaluate'
import type { CandidateProfile, ElectorateState, VoterGroup } from './types'

function buildGroups(j: JurisdictionDemographics, model: VoterModel): VoterGroup[] {
  const byId = new Map(model.behavior.map((b) => [b.segmentId, b]))
  const groups: VoterGroup[] = []
  for (const [segId, share] of Object.entries(j.segmentShares)) {
    if (share <= 0) continue
    const b = byId.get(segId)
    if (!b) throw new Error(`No behaviour for segment '${segId}'`)
    const issuePositions = Object.fromEntries(
      ISSUE_IDS.map((id) => [id, b.issuePositions[id] ?? 0]),
    ) as Record<IssueId, number>
    const issueSalience = Object.fromEntries(
      ISSUE_IDS.map((id) => [id, (b.issueSalience[id] ?? 1) * (ISSUE_BASE_SALIENCE[id] ?? 1)]),
    ) as Record<IssueId, number>
    groups.push({
      id: segId,
      weight: share,
      cvap: share * j.cvap,
      partisanLean: b.partisanLean,
      partisanStrength: b.partisanStrength,
      issuePositions,
      issueSalience,
      turnoutPropensity: b.turnoutPropensity,
    })
  }
  return groups
}

function meanPropensity(groups: readonly VoterGroup[]): number {
  const wsum = groups.reduce((a, g) => a + g.weight, 0)
  if (wsum === 0) return 1
  return groups.reduce((a, g) => a + g.weight * g.turnoutPropensity, 0) / wsum
}

const genericCandidates = (): CandidateProfile[] => [
  {
    candidateId: '__generic_D',
    party: 'D',
    positions: GENERIC_D,
    valence: 0.5,
    incumbent: false,
    awareness: 1,
    favorability: 0,
  },
  {
    candidateId: '__generic_R',
    party: 'R',
    positions: GENERIC_R,
    valence: 0.5,
    incumbent: false,
    awareness: 1,
    favorability: 0,
  },
]

/** Predicted Democratic two-party share for a trial offset. Monotonic increasing in offset. */
function predictedDShare(base: Omit<ElectorateState, 'calibrationOffset'>, offset: number): number {
  const res = evaluateElectorate({ ...base, calibrationOffset: offset }, genericCandidates())
  return res.sharesByCandidate['__generic_D'] ?? 0
}

/** Bisect the calibration offset so the modelled baseline D share hits the real target. */
export function fitCalibrationOffset(
  base: Omit<ElectorateState, 'calibrationOffset'>,
  targetDShare: number,
  iterations = 60,
): number {
  let lo = -6
  let hi = 6
  // predictedDShare is increasing in offset, so standard bisection converges.
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (predictedDShare(base, mid) < targetDShare) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function buildElectorate(j: JurisdictionDemographics, model: VoterModel): ElectorateState {
  const groups = buildGroups(j, model)
  const base: Omit<ElectorateState, 'calibrationOffset'> = {
    jurisdictionId: j.id,
    cvap: j.cvap,
    groups,
    baselineTurnout: j.baselineTurnout,
    meanPropensity: meanPropensity(groups),
  }
  const target = leanToTargetDShare(j.baselinePartisanLean)
  const calibrationOffset = fitCalibrationOffset(base, target)
  return { ...base, calibrationOffset }
}
