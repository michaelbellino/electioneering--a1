/** Governing-phase tests: office types differ, approval responds, terms end, determinism holds. */
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, type GameState } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { buildPaRaces } from '../../data/scenarios/pa'
import { policySentiment } from './governing'

const SEED = 555

const govRace = buildPaRaces().find((r) => r.scenario.id.includes('governor'))!.scenario

describe('governing phase', () => {
  it('startInOffice skips the campaign; office kind follows the seat', () => {
    const leg = createGame(HOUSE_SPECIAL_PA07, SEED, { startInOffice: true })
    expect(leg.phase).toBe('governing')
    expect(leg.governing?.office).toBe('legislator')
    expect(leg.governing?.docket.length).toBe(2)

    const exec = createGame(govRace, SEED, { startInOffice: true })
    expect(exec.governing?.office).toBe('executive')
    expect(exec.governing?.docket.length).toBe(3)
  })

  it('legislator: a popular vote raises approval, an unpopular one lowers it', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, SEED, { startInOffice: true })
    const bill = s.governing!.docket[0]!
    const yeaSentiment = policySentiment(s, bill.policyId, bill.direction)
    const popularVote = yeaSentiment >= 0.5 ? 'yea' : 'nay'
    const unpopularVote = popularVote === 'yea' ? 'nay' : 'yea'

    const good = applyAction(s, { type: 'gov/vote', payload: { billId: bill.id, vote: popularVote } })
    const bad = applyAction(s, { type: 'gov/vote', payload: { billId: bill.id, vote: unpopularVote } })
    expect(good.governing!.approval).toBeGreaterThan(s.governing!.approval)
    expect(bad.governing!.approval).toBeLessThan(s.governing!.approval)
    expect(good.governing!.docket.length).toBe(1) // bill consumed
  })

  it('legislator: skipped votes cost approval on tick (absences)', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, SEED, { startInOffice: true })
    const next = applyAction(s, { type: 'gov/advanceWeek', payload: {} })
    expect(next.governing!.record.some((r) => r.text.includes('Missed'))).toBe(true)
  })

  it('executive: one signature per week, implementation rolls next week (deterministic)', () => {
    let s = createGame(govRace, SEED, { startInOffice: true })
    const item = s.governing!.docket[0]!
    s = applyAction(s, { type: 'gov/sign', payload: { billId: item.id } })
    expect(s.governing!.pendingOutcome).not.toBeNull()
    expect(s.governing!.docket.length).toBe(0) // agenda consumed — one big move a week
    const a = applyAction(s, { type: 'gov/advanceWeek', payload: {} })
    const b = applyAction(s, { type: 'gov/advanceWeek', payload: {} })
    expect(a.governing).toEqual(b.governing) // seeded rollout roll
    expect(a.governing!.pendingOutcome).toBeNull()
    expect(a.governing!.record.some((r) => r.text.includes('rollout') || r.text.includes('Rollout'))).toBe(true)
  })

  it('the term ends after termWeeks and the game reaches the ended phase', () => {
    let s: GameState = createGame(HOUSE_SPECIAL_PA07, SEED, { startInOffice: true })
    for (let i = 0; i < 30 && s.phase === 'governing'; i++) {
      s = applyAction(s, { type: 'gov/advanceWeek', payload: {} })
    }
    expect(s.phase).toBe('ended')
    expect(s.governing!.week).toBeGreaterThan(s.governing!.termWeeks)
  })

  it('a campaign winner can take the office they won (campaign → legislature loop)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED, { difficultyId: 'easy' })
    // Grind a winnable race deterministically.
    for (let i = 0; i < 40 && s.phase === 'campaign'; i++) {
      s = applyAction(s, { type: 'campaign/action', payload: { defId: 'rally' } })
      s = applyAction(s, { type: 'campaign/action', payload: { defId: 'fundraiser' } })
      s = applyAction(s, { type: 'core/advanceTurn', payload: {} })
    }
    expect(s.phase).toBe('election_night')
    if (s.result?.winnerIds[0] === s.playerCandidateId) {
      const inOffice = applyAction(s, { type: 'gov/takeOffice', payload: {} })
      expect(inOffice.phase).toBe('governing')
      expect(inOffice.governing?.office).toBe('legislator')
    }
  })
})
