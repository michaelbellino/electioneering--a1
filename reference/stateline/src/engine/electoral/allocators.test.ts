import { beforeAll, describe, expect, it } from 'vitest'
import { getJurisdiction, loadDemographics, loadVoterModel } from '../../data/loader'
import type { DemographicsDataset, VoterModel } from '../../data/schema'
import { Rng } from '../core/rng'
import { buildElectorate } from '../electorate/build'
import { GENERIC_D, GENERIC_R } from '../electorate/model'
import type { CandidateProfile } from '../electorate/types'
import { allocateFPTP } from './allocators'
import { resolveElection } from './resolve'

describe('FPTP allocator', () => {
  it('picks the plurality winner and computes margin', () => {
    const res = allocateFPTP({ A: 100, B: 60, C: 40 })
    expect(res.winnerIds).toEqual(['A'])
    expect(res.margin).toBeCloseTo((100 - 60) / 200) // 0.2
    expect(res.status).toBe('resolved')
    expect(res.sharesByCandidate['A']).toBeCloseTo(0.5)
  })

  it('breaks an exact tie deterministically (lexicographic) without rng', () => {
    const res = allocateFPTP({ B: 50, A: 50 })
    expect(res.winnerIds).toEqual(['A']) // smallest id
    expect(res.margin).toBe(0)
  })

  it('breaks an exact tie reproducibly with a seeded rng', () => {
    const a = allocateFPTP({ A: 50, B: 50 }, { rng: new Rng(123) })
    const b = allocateFPTP({ A: 50, B: 50 }, { rng: new Rng(123) })
    expect(a.winnerIds).toEqual(b.winnerIds)
  })
})

describe('resolveElection — from a real calibrated electorate', () => {
  let model: VoterModel
  let demographics: DemographicsDataset
  const D: CandidateProfile = {
    candidateId: 'D',
    party: 'D',
    positions: GENERIC_D,
    valence: 0.5,
    incumbent: false,
    awareness: 1,
    favorability: 0,
  }
  const R: CandidateProfile = { ...D, candidateId: 'R', party: 'R', positions: GENERIC_R }

  beforeAll(() => {
    model = loadVoterModel()
    demographics = loadDemographics()
  })

  it('a safe-D district elects the Democrat; a safe-R district elects the Republican', () => {
    const ny = buildElectorate(getJurisdiction(demographics, 'us-ny-cd13'), model)
    const tx = buildElectorate(getJurisdiction(demographics, 'us-tx-cd13'), model)
    expect(resolveElection(ny, [D, R], 'fptp').winnerIds).toEqual(['D'])
    expect(resolveElection(tx, [D, R], 'fptp').winnerIds).toEqual(['R'])
  })

  it('produces a believable turnout and total vote count', () => {
    const j = getJurisdiction(demographics, 'us-pa-cd07')
    const e = buildElectorate(j, model)
    const res = resolveElection(e, [D, R], 'fptp')
    const totalVotes = Object.values(res.votesByCandidate).reduce((a, b) => a + b, 0)
    // Roughly turnout × CVAP ballots cast.
    expect(totalVotes).toBeGreaterThan(j.cvap * 0.3)
    expect(totalVotes).toBeLessThan(j.cvap)
    expect(res.turnout).toBeCloseTo(j.baselineTurnout, 1)
  })

  it('is deterministic across repeated runs', () => {
    const e = buildElectorate(getJurisdiction(demographics, 'us-pa-cd07'), model)
    expect(resolveElection(e, [D, R], 'fptp')).toEqual(resolveElection(e, [D, R], 'fptp'))
  })
})
