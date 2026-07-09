import { describe, expect, it } from 'vitest'
import { CAMPAIGN_ACTIONS, getCampaignAction } from '../../data/campaign/actions'
import type { ScheduledEffect } from '../core/ledger'
import { financeBalances } from './finance'
import {
  applyCampaignAction,
  createCampaign,
  createCandidate,
  tickCampaign,
} from './logic'
import { deriveCandidateProfile, valenceOf } from './profile'
import type { StaffMember } from './types'

const USD = (d: number) => Math.round(d * 100)

const cand = (over = {}) => createCandidate({ id: 'c', name: 'Test', party: 'D', ...over })
const camp = (over = {}) =>
  createCampaign({
    candidateId: 'c',
    electionId: 'e',
    jurisdictionId: 'us-pa-cd07',
    opponentIds: ['opp'],
    startingCash: USD(1_000_000),
    maxActionPoints: 100,
    ...over,
  })

describe('campaign — candidate & finance', () => {
  it('creates a candidate with a full issue platform', () => {
    const c = createCandidate({ name: 'A', party: 'R', positions: { immigration: -0.8 } })
    expect(c.positions.immigration).toBe(-0.8)
    expect(c.positions.healthcare).toBe(0) // defaulted
  })

  it('valence increases with charisma', () => {
    expect(valenceOf(cand({ attributes: { charisma: 0.9 } }))).toBeGreaterThan(
      valenceOf(cand({ attributes: { charisma: 0.1 } })),
    )
  })

  it('keeps the finance invariant cash = raised - spent through actions', () => {
    let c = camp()
    const ad = getCampaignAction('tv_ad_positive')!
    for (let i = 0; i < 5; i++) {
      const res = applyCampaignAction(c, cand(), ad, { day: 0, ledgerLength: 0 })
      expect(res.ok).toBe(true)
      c = res.campaign
      expect(financeBalances(c.finance)).toBe(true)
    }
  })
})

describe('campaign — action gating (no partial mutation)', () => {
  it('rejects an action the campaign cannot afford and leaves state unchanged', () => {
    const c = camp({ startingCash: USD(100) })
    const ad = getCampaignAction('tv_ad_positive')! // costs $25k
    const res = applyCampaignAction(c, cand(), ad, { day: 0, ledgerLength: 0 })
    expect(res.ok).toBe(false)
    expect(res.errors[0]?.code).toBe('insufficient_funds')
    expect(res.campaign).toBe(c) // unchanged reference
    expect(res.newEffects).toHaveLength(0)
  })

  it('rejects an action with no action points left', () => {
    const c = camp({ maxActionPoints: 0 })
    const res = applyCampaignAction(c, cand(), getCampaignAction('speech')!, { day: 0, ledgerLength: 0 })
    expect(res.ok).toBe(false)
    expect(res.errors[0]?.code).toBe('no_ap')
  })

  it('enforces cooldowns', () => {
    const c = camp()
    const speech = getCampaignAction('speech')! // 5-day cooldown
    const first = applyCampaignAction(c, cand(), speech, { day: 0, ledgerLength: 0 })
    expect(first.ok).toBe(true)
    const tooSoon = applyCampaignAction(first.campaign, cand(), speech, { day: 1, ledgerLength: 0 })
    expect(tooSoon.ok).toBe(false)
    expect(tooSoon.errors[0]?.code).toBe('on_cooldown')
    const later = applyCampaignAction(first.campaign, cand(), speech, { day: 5, ledgerLength: 0 })
    expect(later.ok).toBe(true)
  })
})

describe('campaign — fundraising', () => {
  it('raises money, scaled by candidate ability and fundraiser staff', () => {
    const fundraiser = getCampaignAction('fundraiser')!
    const weak = applyCampaignAction(camp(), cand({ attributes: { fundraising: 0.1 } }), fundraiser, {
      day: 0,
      ledgerLength: 0,
    })
    const strong = applyCampaignAction(camp(), cand({ attributes: { fundraising: 0.9 } }), fundraiser, {
      day: 0,
      ledgerLength: 0,
    })
    expect(weak.raised).toBeGreaterThan(0)
    expect(strong.raised).toBeGreaterThan(weak.raised)

    const staff: StaffMember[] = [
      { id: 's1', role: 'fundraiser', weeklySalary: USD(2000), effectiveness: 1 },
    ]
    const withStaff = applyCampaignAction(camp({ staff }), cand(), fundraiser, { day: 0, ledgerLength: 0 })
    const without = applyCampaignAction(camp(), cand(), fundraiser, { day: 0, ledgerLength: 0 })
    expect(withStaff.raised).toBeGreaterThan(without.raised)
  })
})

describe('campaign — effects on the electorate (via ledger)', () => {
  it('name recognition saturates toward 1 with diminishing returns', () => {
    let c = camp()
    let ledger: ScheduledEffect[] = []
    const ad = getCampaignAction('tv_ad_positive')!
    const awareness: number[] = []
    for (let i = 0; i < 8; i++) {
      const res = applyCampaignAction(c, cand(), ad, { day: 0, ledgerLength: ledger.length })
      c = res.campaign
      ledger = [...ledger, ...res.newEffects]
      awareness.push(deriveCandidateProfile(cand(), 'us-pa-cd07', ledger, 5).awareness)
    }
    // Monotonic increasing, strictly below 1, with shrinking increments (diminishing returns).
    for (let i = 1; i < awareness.length; i++) expect(awareness[i]!).toBeGreaterThan(awareness[i - 1]!)
    expect(awareness[awareness.length - 1]!).toBeLessThan(1)
    expect(awareness[1]! - awareness[0]!).toBeGreaterThan(
      awareness[7]! - awareness[6]!,
    )
  })

  it('an attack ad lowers the opponent’s favorability', () => {
    const attack = getCampaignAction('tv_ad_attack')!
    const res = applyCampaignAction(camp(), cand(), attack, { day: 0, ledgerLength: 0 })
    const opp = createCandidate({ id: 'opp', name: 'Opp', party: 'R' })
    const prof = deriveCandidateProfile(opp, 'us-pa-cd07', res.newEffects, 10)
    expect(prof.favorability).toBeLessThan(0)
  })

  it('is deterministic: identical action sequences produce identical effects', () => {
    const run = () => {
      let c = camp()
      let ledger: ScheduledEffect[] = []
      for (const id of ['speech', 'rally', 'tv_ad_positive']) {
        const res = applyCampaignAction(c, cand(), getCampaignAction(id)!, {
          day: 0,
          ledgerLength: ledger.length,
        })
        c = res.campaign
        ledger = [...ledger, ...res.newEffects]
      }
      return ledger
    }
    expect(run()).toEqual(run())
  })
})

describe('campaign — weekly tick', () => {
  it('regenerates action points, books small-dollar income, pays staff, stays balanced', () => {
    const staff: StaffMember[] = [
      { id: 's1', role: 'manager', weeklySalary: USD(3000), effectiveness: 1 },
    ]
    let c = camp({ maxActionPoints: 3, staff })
    c = { ...c, actionPoints: 0 }
    const res = tickCampaign(c, cand(), 7)
    expect(res.campaign.actionPoints).toBe(3)
    expect(res.raised).toBeGreaterThan(0)
    expect(res.salariesPaid).toBe(USD(3000))
    expect(financeBalances(res.campaign.finance)).toBe(true)
  })
})

describe('campaign — content pack', () => {
  it('exposes the data-driven action set', () => {
    expect(CAMPAIGN_ACTIONS.length).toBeGreaterThanOrEqual(5)
    for (const a of CAMPAIGN_ACTIONS) {
      expect(a.id).toBeTruthy()
      expect(a.cashCost).toBeGreaterThanOrEqual(0)
    }
  })
})
