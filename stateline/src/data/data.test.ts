import { describe, expect, it } from 'vitest'
import { loadContent, loadDemographics, loadVoterModel } from './loader'
import { ISSUE_IDS } from './schema'

describe('voter model', () => {
  const model = loadVoterModel()

  it('defines behaviour for every segment', () => {
    const segIds = new Set(model.segments.map((s) => s.id))
    const behaviorIds = new Set(model.behavior.map((b) => b.segmentId))
    expect(behaviorIds).toEqual(segIds)
  })

  it('defines positions and salience for every issue in every segment', () => {
    for (const b of model.behavior) {
      for (const issue of ISSUE_IDS) {
        expect(b.issuePositions[issue], `${b.segmentId}.${issue} position`).toBeTypeOf('number')
        expect(b.issueSalience[issue], `${b.segmentId}.${issue} salience`).toBeTypeOf('number')
      }
    }
  })

  it('encodes the diploma divide (white college more Democratic than white non-college)', () => {
    const wc = model.behavior.find((b) => b.segmentId === 'white_college')!
    const wnc = model.behavior.find((b) => b.segmentId === 'white_noncollege')!
    expect(wc.partisanLean).toBeGreaterThan(wnc.partisanLean)
  })

  it('encodes Black voters as the most Democratic-leaning segment', () => {
    const leans = model.behavior.map((b) => b.partisanLean)
    const black = model.behavior.find((b) => b.segmentId === 'black')!
    expect(black.partisanLean).toBe(Math.max(...leans))
  })
})

describe('demographics dataset', () => {
  it('loads and validates the seed snapshot', () => {
    const ds = loadDemographics()
    expect(ds.jurisdictions.length).toBeGreaterThan(0)
  })

  it('has segment shares summing to ~1 for every jurisdiction', () => {
    const ds = loadDemographics()
    for (const j of ds.jurisdictions) {
      const total = Object.values(j.segmentShares).reduce((a, b) => a + b, 0)
      expect(total, j.id).toBeCloseTo(1, 1)
    }
  })

  it('rejects a jurisdiction whose shares do not sum to 1', () => {
    const bad = {
      dataVersion: 't',
      sources: [],
      generatedNote: '',
      jurisdictions: [
        {
          id: 'bad',
          name: 'Bad',
          level: 'state',
          geoid: '99',
          parentId: null,
          population: 100,
          cvap: 80,
          registeredVoters: 70,
          medianHouseholdIncome: 50000,
          medianAge: 40,
          segmentShares: { white_college: 0.2, black: 0.2 }, // sums to 0.4
          baselinePartisanLean: 0,
          baselineTurnout: 0.5,
          provisional: true,
        },
      ],
    }
    expect(() => loadDemographics(bad)).toThrow(/sum/)
  })

  it('rejects an unknown segment id', () => {
    const bad = {
      dataVersion: 't',
      sources: [],
      generatedNote: '',
      jurisdictions: [
        {
          id: 'bad',
          name: 'Bad',
          level: 'state',
          geoid: '99',
          parentId: null,
          population: 100,
          cvap: 80,
          registeredVoters: 70,
          medianHouseholdIncome: 50000,
          medianAge: 40,
          segmentShares: { not_a_real_segment: 1.0 },
          baselinePartisanLean: 0,
          baselineTurnout: 0.5,
          provisional: true,
        },
      ],
    }
    expect(() => loadDemographics(bad)).toThrow(/unknown segment/)
  })

  it('loads combined content', () => {
    const { voterModel, demographics } = loadContent()
    expect(voterModel.segments.length).toBe(6)
    expect(demographics.jurisdictions.find((j) => j.id === 'us-pa-cd07')).toBeDefined()
  })
})
