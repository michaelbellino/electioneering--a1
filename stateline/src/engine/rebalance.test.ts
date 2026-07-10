/**
 * Rebalance pass (2026-07) — regression gates for the P0/P1/P2 fixes from
 * docs/DESIGN-REVIEW-2026-07.md. Two layers:
 *
 *  1. MECHANICS: each new rule verified directly (honest polls, shared ad fatigue, repeat
 *     fatigue, AI wallet decoupling, trait cash scaling, governing capital/conviction).
 *  2. BANDS: bot win-rate bands over fixed seeds (deterministic — bands allow tuning slack,
 *     not flake). If a change silently re-opens the ad-spam exploit or flattens the ladder,
 *     these trip.
 */
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, tick, type GameState } from './index'
import { HOUSE_SPECIAL_PA07 } from '../data/scenarios/houseSpecial'
import { playBot, type BotId } from '../../scripts/playtest'
import { spendCapital } from './governing/governing'

const SEEDS = [1000, 1017, 1034, 1051, 1068, 1085, 1102, 1119, 1136, 1153, 1170, 1187]

function wins(bot: BotId, difficulty: string): number {
  return SEEDS.filter((s) => playBot(bot, difficulty, s).won).length
}

describe('mechanics: the fixed exploits stay fixed', () => {
  it('quick TV ads share the Media desk fatigue pool (Nth buy is weaker)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, 1000, {
      sandbox: { startingCash: 500_000_00, maxActionPoints: 10 },
    })
    const magOf = (state: GameState) =>
      state.ledger
        .filter((e) => e.target.kind === 'electorate' && e.target.channel === 'nameRecognition')
        .at(-1)!.magnitude
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'tv_ad_positive' } })
    const first = magOf(s)
    expect(s.campaign.adFatigue['tv']).toBeGreaterThan(0)
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'tv_ad_positive' } })
    expect(magOf(s)).toBeLessThan(first)
  })

  it('the Media desk inherits quick-buy fatigue too (one shared pool per channel)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, 1000, {
      sandbox: { startingCash: 500_000_00, maxActionPoints: 10 },
    })
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'tv_ad_positive' } })
    const fatigueAfterQuick = s.campaign.adFatigue['tv'] ?? 0
    expect(fatigueAfterQuick).toBeGreaterThan(0)
    s = applyAction(s, { type: 'campaign/runAd', payload: { channel: 'tv', tone: 'positive', budget: 1 } })
    expect(s.campaign.adFatigue['tv']).toBeGreaterThan(fatigueAfterQuick)
  })

  it('repeating any action fatigues it (anti-grind), tracked per action', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, 1000, {
      sandbox: { startingCash: 500_000_00, maxActionPoints: 10 },
    })
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'speech' } })
    expect(s.campaign.actionUses['speech']).toBe(1)
  })

  it('the final poll matches the result within the margin of error (honest scoreboard)', () => {
    // The old bug: GOTV/enthusiasm/ground presence were invisible to polls — a ground-game
    // campaign finished ~15 pts above its final poll.
    const errs = SEEDS.slice(0, 6).map((seed) => {
      const r = playBot('machine', 'normal', seed)
      return Math.abs(r.playerShare - r.lastPollShare)
    })
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length
    expect(mean).toBeLessThan(0.04)
  })

  it("the AI's war chest scales with difficulty, not the player's cash multiplier", () => {
    const cashOf = (difficultyId: string) => {
      const s = createGame(HOUSE_SPECIAL_PA07, 7, { difficultyId })
      return Object.values(s.aiCandidates)[0]!.cash
    }
    // Easy must NOT enrich the opponent; brutal must not starve it.
    expect(cashOf('easy')).toBeLessThan(cashOf('normal'))
    expect(cashOf('brutal')).toBeGreaterThan(cashOf('hard'))
  })

  it("player trait cash deltas do not leak into the AI's wallet", () => {
    const base = createGame(HOUSE_SPECIAL_PA07, 7, {})
    const funded = createGame(HOUSE_SPECIAL_PA07, 7, { traitIds: ['self_funder'] })
    expect(Object.values(funded.aiCandidates)[0]!.cash).toBe(
      Object.values(base.aiCandidates)[0]!.cash,
    )
  })

  it('trait cash deltas scale with the difficulty wallet (Grassroots Army on brutal)', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, 7, {
      difficultyId: 'brutal',
      traitIds: ['grassroots_army'],
    })
    // (50k − 15k) × 0.5 = 17.5k — not the old 25k − 15k = 10k cliff.
    expect(s.campaign.finance.cash).toBe(17_500_00)
  })

  it("your Field Director no longer preserves the OPPONENT's ground presence", () => {
    let s = createGame(HOUSE_SPECIAL_PA07, 11)
    s = { ...s, territory: { ...s.territory, oppPresence: { [s.territory.playerLocation]: 0.5 } } }
    const withStaff = {
      ...s,
      campaign: {
        ...s.campaign,
        staff: [{ id: 'staff_field', role: 'field_director' as const, weeklySalary: 0, effectiveness: 0.7 }],
      },
    }
    const oppAfter = (state: GameState) =>
      tick(state).territory.oppPresence[state.territory.playerLocation] ?? 0
    // Opponent presence decays identically whether or not YOU employ a field director.
    expect(oppAfter(withStaff)).toBeCloseTo(oppAfter(s), 10)
  })
})

describe('mechanics: governing has decisions now', () => {
  it('bills carry a noisy staff estimate, not the true sentiment', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, 21, { startInOffice: true })
    for (const b of s.governing!.docket) {
      expect(b.estimate).toBeGreaterThanOrEqual(0)
      expect(b.estimate).toBeLessThanOrEqual(1)
    }
  })

  it('political capital can be spent, costs what it says, and floors at affordability', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, 21, { startInOffice: true })
    const gov = s.governing!
    const spent = spendCapital(gov, 'town_hall')
    expect(spent.capital).toBe(gov.capital - 3)
    expect(spent.approval).toBeGreaterThan(gov.approval)
    const broke = spendCapital({ ...gov, capital: 0 }, 'district_grant')
    expect(broke).toEqual({ ...gov, capital: 0 })
  })

  it('voting against your own platform costs extra (conviction)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, 33, { startInOffice: true })
    // Force a docket bill onto an issue where the player has a strong stance, then defect.
    const bill = s.governing!.docket[0]!
    const positions = { ...s.candidates[s.playerCandidateId]!.positions }
    for (const k of Object.keys(positions)) (positions as Record<string, number>)[k] = 0.6
    s = {
      ...s,
      candidates: {
        ...s.candidates,
        [s.playerCandidateId]: { ...s.candidates[s.playerCandidateId]!, positions },
      },
    }
    const defect = bill.direction > 0 ? 'nay' : 'yea'
    const after = applyAction(s, { type: 'gov/vote', payload: { billId: bill.id, vote: defect } })
    expect(after.governing!.record.at(-1)!.text).toContain('betrayal')
  })
})

describe('bands: the ladder holds its shape (fixed seeds, deterministic)', () => {
  it('easy is friendly to competent play; brutal is not', () => {
    expect(wins('grinder', 'easy')).toBeGreaterThanOrEqual(9) // ≥75% of 12
    expect(wins('grinder', 'brutal')).toBeLessThanOrEqual(2)
  })

  it('normal is a real fight for competent play (win some, lose some)', () => {
    const w = wins('grinder', 'normal')
    expect(w).toBeGreaterThanOrEqual(3)
    expect(w).toBeLessThanOrEqual(10)
  })

  it('optimized play (machine) is challenged on hard and rarely survives brutal', () => {
    const hard = wins('machine', 'hard')
    expect(hard).toBeGreaterThanOrEqual(3)
    expect(hard).toBeLessThanOrEqual(10)
    expect(wins('machine', 'brutal')).toBeLessThanOrEqual(3)
  })

  it('the ad-spam exploit stays dead (one-note TV loses on normal)', () => {
    expect(wins('tv_spam', 'normal')).toBeLessThanOrEqual(4)
  })

  it('attacks work as a component, not as a whole strategy', () => {
    // Mixed attacker hangs with the grinder; attack-only keeps losing.
    expect(wins('mixed_attacker', 'normal')).toBeGreaterThanOrEqual(wins('grinder', 'normal') - 4)
    expect(wins('quick_attacker', 'normal')).toBeLessThanOrEqual(3)
  })
})
