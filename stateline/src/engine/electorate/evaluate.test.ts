import { beforeAll, describe, expect, it } from 'vitest'
import { getJurisdiction, loadDemographics, loadVoterModel } from '../../data/loader'
import type { DemographicsDataset, VoterModel } from '../../data/schema'
import { buildElectorate } from './build'
import { evaluateElectorate, groupUtility } from './evaluate'
import { GENERIC_D, GENERIC_R, leanToTargetDShare } from './model'
import type { CandidateProfile } from './types'

let model: VoterModel
let demographics: DemographicsDataset

beforeAll(() => {
  model = loadVoterModel()
  demographics = loadDemographics()
})

const genericD = (over: Partial<CandidateProfile> = {}): CandidateProfile => ({
  candidateId: 'D',
  party: 'D',
  positions: GENERIC_D,
  valence: 0.5,
  incumbent: false,
  awareness: 1,
  favorability: 0,
  ...over,
})
const genericR = (over: Partial<CandidateProfile> = {}): CandidateProfile => ({
  candidateId: 'R',
  party: 'R',
  positions: GENERIC_R,
  valence: 0.5,
  incumbent: false,
  awareness: 1,
  favorability: 0,
  ...over,
})

describe('electorate — invariants', () => {
  it('vote shares sum to 1 and turnout is a valid fraction', () => {
    const e = buildElectorate(getJurisdiction(demographics, 'us-pa-cd07'), model)
    const res = evaluateElectorate(e, [genericD(), genericR()])
    const total = Object.values(res.sharesByCandidate).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 6)
    expect(res.turnout).toBeGreaterThan(0)
    expect(res.turnout).toBeLessThanOrEqual(1)
  })

  it('is deterministic — identical inputs give identical output', () => {
    const e = buildElectorate(getJurisdiction(demographics, 'us-pa-cd07'), model)
    const a = evaluateElectorate(e, [genericD(), genericR()])
    const b = evaluateElectorate(e, [genericD(), genericR()])
    expect(a).toEqual(b)
  })

  it('turnout tracks the calibrated baseline (CVAP-weighted)', () => {
    const j = getJurisdiction(demographics, 'us-pa-cd07')
    const e = buildElectorate(j, model)
    const res = evaluateElectorate(e, [genericD(), genericR()])
    // The relative-propensity scaling keeps overall turnout within a few points of the baseline.
    expect(res.turnout).toBeCloseTo(j.baselineTurnout, 1)
  })
})

describe('electorate — calibration faithfulness (verifiable against real lean)', () => {
  it('reproduces each jurisdiction baseline lean within 1 point', () => {
    for (const j of demographics.jurisdictions) {
      const e = buildElectorate(j, model)
      const res = evaluateElectorate(e, [genericD(), genericR()])
      const dShare = res.sharesByCandidate['D']!
      const target = leanToTargetDShare(j.baselinePartisanLean)
      expect(Math.abs(dShare - target), `${j.id} D share`).toBeLessThan(0.01)
    }
  })

  it('orders jurisdictions correctly (NY safe-D > PA tossup > TX safe-R)', () => {
    const share = (id: string) => {
      const e = buildElectorate(getJurisdiction(demographics, id), model)
      return evaluateElectorate(e, [genericD(), genericR()]).sharesByCandidate['D']!
    }
    expect(share('us-ny-cd13')).toBeGreaterThan(share('us-pa-cd07'))
    expect(share('us-pa-cd07')).toBeGreaterThan(share('us-tx-cd13'))
    expect(share('us-pa-cd07')).toBeCloseTo(0.5, 1) // a genuine tossup
  })
})

describe('electorate — comparative statics (model behaves correctly)', () => {
  const e = () => buildElectorate(getJurisdiction(demographics, 'us-pa-cd07'), model)

  it('a higher-valence candidate gains share, all else equal', () => {
    const base = evaluateElectorate(e(), [genericD(), genericR()]).sharesByCandidate['D']!
    const better = evaluateElectorate(e(), [genericD({ valence: 0.9 }), genericR()])
      .sharesByCandidate['D']!
    expect(better).toBeGreaterThan(base)
  })

  it('higher favorability gains share', () => {
    const base = evaluateElectorate(e(), [genericD(), genericR()]).sharesByCandidate['D']!
    const liked = evaluateElectorate(e(), [genericD({ favorability: 0.5 }), genericR()])
      .sharesByCandidate['D']!
    expect(liked).toBeGreaterThan(base)
  })

  it('an unknown candidate (awareness 0) wins essentially no votes', () => {
    const res = evaluateElectorate(e(), [genericD({ awareness: 0 }), genericR({ awareness: 1 })])
    expect(res.sharesByCandidate['D']!).toBeLessThan(0.01)
    expect(res.sharesByCandidate['R']!).toBeGreaterThan(0.99)
  })

  it('spatial proximity: matching a group’s issue stance raises that group’s utility', () => {
    // white_noncollege holds a restrictive immigration position; a candidate closer to it scores higher
    // utility WITH THAT GROUP (a clean proximity test, isolated from electorate composition effects).
    const e0 = e()
    const group = e0.groups.find((g) => g.id === 'white_noncollege')!
    const aligned = groupUtility(
      group,
      genericR({ positions: { ...GENERIC_R, immigration: group.issuePositions.immigration } }),
      e0.calibrationOffset,
    )
    const misaligned = groupUtility(
      group,
      genericR({ positions: { ...GENERIC_R, immigration: -group.issuePositions.immigration } }),
      e0.calibrationOffset,
    )
    expect(aligned).toBeGreaterThan(misaligned)
  })
})
