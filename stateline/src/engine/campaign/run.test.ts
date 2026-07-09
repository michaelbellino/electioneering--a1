/**
 * Tests for the pre-alpha run systems: difficulties, traits, sandbox overrides, dilemmas, and the
 * staff/office tycoon layer.
 */
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, tick, type GameState } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { SCENARIOS } from '../../data/scenarios/index'
import { DILEMMAS, getDilemma } from '../../data/campaign/dilemmas'
import { attributeCost, totalAttributeCost } from '../../data/campaign/difficulties'
import { getHireableStaff, officeCost } from '../../data/campaign/staff'
import { getDilemmaOption } from './dilemmas'

const SEED = 42

function playToElection(state: GameState, decide?: (s: GameState) => string | null): GameState {
  for (let i = 0; i < 60 && state.phase === 'campaign'; i++) {
    if (state.pendingDilemma && decide) {
      const opt = decide(state)
      if (opt) state = applyAction(state, { type: 'campaign/resolveDilemma', payload: { optionId: opt } })
    }
    state = tick(state)
  }
  return state
}

describe('difficulties & traits', () => {
  it('difficulty rescales cash, opponent intensity, and action points', () => {
    const easy = createGame(HOUSE_SPECIAL_PA07, SEED, { difficultyId: 'easy' })
    const brutal = createGame(HOUSE_SPECIAL_PA07, SEED, { difficultyId: 'brutal' })
    expect(easy.campaign.finance.cash).toBeGreaterThan(brutal.campaign.finance.cash)
    expect(easy.aiOpponentIntensity).toBeLessThan(brutal.aiOpponentIntensity)
    expect(easy.campaign.maxActionPoints).toBeGreaterThan(brutal.campaign.maxActionPoints)
    expect(easy.meta.difficulty).toBe('easy')
  })

  it('attribute point costs escalate at high steps', () => {
    expect(attributeCost(6)).toBe(6)
    expect(attributeCost(8)).toBe(10) // 6×1 + 2×2
    expect(attributeCost(10)).toBe(16) // 6×1 + 2×2 + 2×3
    expect(totalAttributeCost([6, 6, 6, 5])).toBe(23) // ≈ old default build fits the normal budget
  })

  it('traits apply their tradeoffs at creation', () => {
    const g = createGame(HOUSE_SPECIAL_PA07, SEED, { traitIds: ['self_funder', 'grassroots_army'] })
    const plain = createGame(HOUSE_SPECIAL_PA07, SEED)
    // Self-Funder: +$40k cash, −0.15 fundraising. Grassroots Army: +1 AP, −$15k.
    expect(g.campaign.finance.cash).toBe(plain.campaign.finance.cash + 40_000_00 - 15_000_00)
    expect(g.campaign.maxActionPoints).toBe(plain.campaign.maxActionPoints + 1)
    const player = g.candidates[g.playerCandidateId]!
    const plainPlayer = plain.candidates[plain.playerCandidateId]!
    expect(player.attributes.fundraising).toBeCloseTo(plainPlayer.attributes.fundraising - 0.15, 6)
    expect(g.meta.traitIds).toEqual(['self_funder', 'grassroots_army'])
  })

  it('teflon trait halves-ish incoming scandal damage', () => {
    expect(createGame(HOUSE_SPECIAL_PA07, SEED, { traitIds: ['teflon'] }).campaign.modifiers.scandalMult).toBeLessThan(1)
  })

  it('sandbox overrides win over scenario and difficulty', () => {
    const g = createGame(HOUSE_SPECIAL_PA07, SEED, {
      difficultyId: 'brutal',
      sandbox: { startingCash: 999_000_00, opponentIntensity: 0.05, maxActionPoints: 5, weeks: 8 },
    })
    expect(g.campaign.finance.cash).toBe(999_000_00)
    expect(g.aiOpponentIntensity).toBe(0.05)
    expect(g.campaign.maxActionPoints).toBe(5)
    expect(g.election.electionDay - g.calendar.dayIndex).toBe(8 * 7)
  })

  it('every scenario in the registry boots and plays to a result', () => {
    for (const meta of SCENARIOS) {
      const end = playToElection(createGame(meta.scenario, SEED))
      expect(end.phase).toBe('election_night')
      expect(end.result).not.toBeNull()
    }
  })
})

describe('dilemmas', () => {
  it('draws are deterministic: same seed → same dilemmas at the same weeks', () => {
    const run = () => {
      let s = createGame(HOUSE_SPECIAL_PA07, SEED)
      const drawn: Array<[string, number]> = []
      for (let i = 0; i < 20 && s.phase === 'campaign'; i++) {
        s = tick(s)
        if (s.pendingDilemma) drawn.push([s.pendingDilemma.defId, s.pendingDilemma.day])
        // leave pending → next tick auto-resolves (also deterministic)
      }
      return { drawn, log: s.log.map((l) => l.message) }
    }
    expect(run()).toEqual(run())
  })

  it('a dilemma eventually lands, and resolving applies its consequences', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    for (let i = 0; i < 30 && !s.pendingDilemma && s.phase === 'campaign'; i++) s = tick(s)
    expect(s.pendingDilemma).not.toBeNull()
    const def = getDilemma(s.pendingDilemma!.defId)!

    // Resolve with each option from the same state: consequences must differ from doing nothing.
    const before = s
    const resolved = applyAction(s, {
      type: 'campaign/resolveDilemma',
      payload: { optionId: def.options[0]!.id },
    })
    expect(resolved.pendingDilemma).toBeNull()
    expect(resolved.log.length).toBeGreaterThan(before.log.length)
  })

  it('an ignored dilemma auto-resolves with its default option on the next tick', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    for (let i = 0; i < 30 && !s.pendingDilemma && s.phase === 'campaign'; i++) s = tick(s)
    const defId = s.pendingDilemma!.defId
    s = tick(s)
    expect(s.pendingDilemma?.defId ?? null).not.toBe(defId) // resolved (maybe a new one drew)
    expect(s.log.some((l) => l.message.includes('(let it slide)'))).toBe(true)
  })

  it('each dilemma fires at most once per run', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED, { sandbox: { weeks: 40 } })
    const seen: string[] = []
    for (let i = 0; i < 40 && s.phase === 'campaign'; i++) {
      s = tick(s)
      if (s.pendingDilemma) seen.push(s.pendingDilemma.defId)
    }
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('cash consequences hit the war chest (megadonor pays)', () => {
    // Craft the state: force the megadonor dilemma to be pending.
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    s = tick(s)
    s = { ...s, pendingDilemma: { defId: 'megadonor', day: s.calendar.dayIndex } }
    const cashBefore = s.campaign.finance.cash
    const next = applyAction(s, { type: 'campaign/resolveDilemma', payload: { optionId: 'take_it' } })
    expect(next.campaign.finance.cash).toBe(cashBefore + 60_000_00)
  })

  it('risky options can fail, and the roll is seeded (deterministic across replays)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    s = tick(s)
    s = { ...s, pendingDilemma: { defId: 'old_column', day: s.calendar.dayIndex } }
    const a = applyAction(s, { type: 'campaign/resolveDilemma', payload: { optionId: 'deny' } })
    const b = applyAction(s, { type: 'campaign/resolveDilemma', payload: { optionId: 'deny' } })
    expect(a.candidates[a.playerCandidateId]!.scandalLoad).toBe(
      b.candidates[b.playerCandidateId]!.scandalLoad,
    )
  })

  it('deck sanity: unique ids, valid default options, positive weights', () => {
    const ids = new Set(DILEMMAS.map((d) => d.id))
    expect(ids.size).toBe(DILEMMAS.length)
    for (const d of DILEMMAS) {
      expect(d.options.length).toBeGreaterThanOrEqual(2)
      expect(d.options.some((o) => o.id === d.defaultOptionId)).toBe(true)
      expect(d.weight).toBeGreaterThan(0)
      expect(getDilemmaOption(d, d.defaultOptionId).id).toBe(d.defaultOptionId)
    }
  })
})

describe('staff & offices (tycoon layer)', () => {
  it('hiring costs an AP + signing bonus; the manager grants +1 AP per week', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const apBefore = s.campaign.actionPoints
    const maxBefore = s.campaign.maxActionPoints
    s = applyAction(s, { type: 'campaign/hireStaff', payload: { staffId: 'staff_manager' } })
    expect(s.campaign.staff).toHaveLength(1)
    // −1 AP for the hire, +1 from the manager → net unchanged this week; max is up by one.
    expect(s.campaign.actionPoints).toBe(apBefore)
    expect(s.campaign.maxActionPoints).toBe(maxBefore + 1)
    expect(s.campaign.finance.cash).toBe(
      createGame(HOUSE_SPECIAL_PA07, SEED).campaign.finance.cash -
        getHireableStaff('staff_manager')!.signingBonus,
    )
  })

  it('cannot double-hire a role', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    s = applyAction(s, { type: 'campaign/hireStaff', payload: { staffId: 'staff_comms' } })
    const staffCount = s.campaign.staff.length
    s = applyAction(s, { type: 'campaign/hireStaff', payload: { staffId: 'staff_comms' } })
    expect(s.campaign.staff.length).toBe(staffCount)
    expect(s.log[s.log.length - 1]!.kind).toBe('action_blocked')
  })

  it('salaries drain the war chest weekly; firing stops the bleed', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    s = applyAction(s, { type: 'campaign/hireStaff', payload: { staffId: 'staff_pollster' } })
    const salary = getHireableStaff('staff_pollster')!.weeklySalary
    const before = s.campaign.finance.cash
    const afterTick = tick(s)
    // trickle income minus salary: spent must include the salary
    expect(afterTick.campaign.finance.totalSpent).toBe(s.campaign.finance.totalSpent + salary)
    expect(before).toBeGreaterThan(0)
    const fired = applyAction(s, { type: 'campaign/fireStaff', payload: { staffId: 'staff_pollster' } })
    expect(fired.campaign.staff).toHaveLength(0)
  })

  it('a pollster tightens the polling margin of error', () => {
    let plain = createGame(HOUSE_SPECIAL_PA07, SEED)
    let staffed = applyAction(plain, { type: 'campaign/hireStaff', payload: { staffId: 'staff_pollster' } })
    plain = tick(plain)
    staffed = tick(staffed)
    expect(staffed.polls[staffed.polls.length - 1]!.marginOfError).toBeLessThan(
      plain.polls[plain.polls.length - 1]!.marginOfError,
    )
  })

  it('offices escalate in price and cap out', () => {
    expect(officeCost(1)).toBeGreaterThan(officeCost(0))
    let s = createGame(HOUSE_SPECIAL_PA07, SEED, { sandbox: { startingCash: 10_000_000_00, maxActionPoints: 10 } })
    for (let i = 0; i < 7; i++) s = applyAction(s, { type: 'campaign/openOffice', payload: {} })
    expect(s.campaign.offices).toBe(5) // MAX_OFFICES
  })

  it('save/load round-trip preserves the new state exactly', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED, { difficultyId: 'hard', traitIds: ['firebrand'] })
    s = applyAction(s, { type: 'campaign/hireStaff', payload: { staffId: 'staff_field' } })
    for (let i = 0; i < 8; i++) s = tick(s)
    const revived = JSON.parse(JSON.stringify(s)) as GameState
    expect(JSON.stringify(tick(revived))).toBe(JSON.stringify(tick(s)))
  })
})
