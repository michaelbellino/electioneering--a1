import { describe, expect, it } from 'vitest'
import { Engine } from '@engine/index'
import { HOUSE_SPECIAL_PA07 } from '@data/scenarios/houseSpecial'
import { getCampaignAction } from '@data/campaign/actions'
import { actionAvailability, pollSeries, standings, weeksToElection } from './selectors'

const game = () => Engine.create(HOUSE_SPECIAL_PA07, 1).getState()

describe('ui selectors', () => {
  it('weeksToElection is positive at the start', () => {
    expect(weeksToElection(game())).toBeGreaterThan(5)
  })

  it('pollSeries is empty until a week is advanced', () => {
    expect(pollSeries(game())).toHaveLength(0)
  })

  it('actionAvailability allows an affordable action and blocks an unaffordable one', () => {
    const state = game()
    const ad = getCampaignAction('tv_ad_positive')! // $25k, start cash $50k
    expect(actionAvailability(state, ad).ok).toBe(true)

    const broke = { ...state, campaign: { ...state.campaign, finance: { ...state.campaign.finance, cash: 0 } } }
    const res = actionAvailability(broke, ad)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/cash/i)
  })

  it('blocks all actions once the campaign is over', () => {
    const state = game()
    const ended = { ...state, phase: 'election_night' as const }
    expect(actionAvailability(ended, getCampaignAction('speech')!).ok).toBe(false)
  })

  it('standings returns a named row per candidate with awareness in [0,1]', () => {
    const rows = standings(game())
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.name).toBeTruthy()
      expect(r.awareness).toBeGreaterThanOrEqual(0)
      expect(r.awareness).toBeLessThanOrEqual(1)
    }
  })

  it('after a week, polls produce a chart series', () => {
    const engine = Engine.create(HOUSE_SPECIAL_PA07, 1)
    engine.advanceTurn()
    const series = pollSeries(engine.getState())
    expect(series).toHaveLength(1)
    expect(series[0]!.player + series[0]!.opponent).toBeCloseTo(100, 0)
  })
})
