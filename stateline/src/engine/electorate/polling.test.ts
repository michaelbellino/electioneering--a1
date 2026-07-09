import { beforeAll, describe, expect, it } from 'vitest'
import { getJurisdiction, loadDemographics, loadVoterModel } from '../../data/loader'
import type { DemographicsDataset, VoterModel } from '../../data/schema'
import { Rng } from '../core/rng'
import { buildElectorate } from './build'
import { evaluateElectorate } from './evaluate'
import { GENERIC_D, GENERIC_R } from './model'
import { conductPoll, marginOfError } from './polling'
import type { CandidateProfile, ElectorateState } from './types'

let model: VoterModel
let demographics: DemographicsDataset
let electorate: ElectorateState

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
  electorate = buildElectorate(getJurisdiction(demographics, 'us-pa-cd07'), model)
})

describe('polling', () => {
  it('reported shares sum to 1', () => {
    const poll = conductPoll(electorate, [D, R], new Rng(1))
    expect(Object.values(poll.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
  })

  it('margin of error shrinks as sample size grows', () => {
    expect(marginOfError(400)).toBeGreaterThan(marginOfError(1600))
    expect(marginOfError(1600)).toBeCloseTo(0.0245, 3)
  })

  it('is deterministic per rng seed and independent across seeds', () => {
    const a1 = conductPoll(electorate, [D, R], new Rng(42))
    const a2 = conductPoll(electorate, [D, R], new Rng(42))
    const b = conductPoll(electorate, [D, R], new Rng(7))
    expect(a1).toEqual(a2)
    expect(a1.shares['D']).not.toEqual(b.shares['D'])
  })

  it('is unbiased: the mean of many polls converges to the true share', () => {
    const truth = evaluateElectorate(electorate, [D, R]).sharesByCandidate['D']!
    const rng = new Rng(2024)
    const N = 4000
    let acc = 0
    for (let i = 0; i < N; i++) acc += conductPoll(electorate, [D, R], rng, { sampleSize: 800 }).shares['D']!
    expect(acc / N).toBeCloseTo(truth, 2)
  })

  it('has ~95% of polls within the margin of error of truth', () => {
    const truth = evaluateElectorate(electorate, [D, R]).sharesByCandidate['D']!
    const rng = new Rng(99)
    const N = 3000
    const sampleSize = 800
    const moe = marginOfError(sampleSize)
    let within = 0
    for (let i = 0; i < N; i++) {
      const s = conductPoll(electorate, [D, R], rng, { sampleSize }).shares['D']!
      if (Math.abs(s - truth) <= moe) within++
    }
    // For a ~50/50 race the per-candidate SE is a touch below the 50% MoE, so coverage is ~95%+.
    expect(within / N).toBeGreaterThan(0.93)
  })

  it('applies a house effect bias in the requested direction', () => {
    const rng = new Rng(5)
    const truth = evaluateElectorate(electorate, [D, R]).sharesByCandidate['D']!
    let acc = 0
    const N = 2000
    for (let i = 0; i < N; i++)
      acc += conductPoll(electorate, [D, R], rng, { houseEffects: { D: 0.05 } }).shares['D']!
    expect(acc / N).toBeGreaterThan(truth) // biased toward D
  })
})
