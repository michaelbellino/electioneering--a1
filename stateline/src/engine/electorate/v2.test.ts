/** M2 tests: spatial elections (the map is the ground truth) and the enthusiasm channel. */
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, tick, type GameState } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { deriveTurnoutBoostMap } from '../campaign/profile'
import { currentProfiles } from '../reducer'

const SEED = 314

function playOut(state: GameState): GameState {
  for (let i = 0; i < 60 && state.phase === 'campaign'; i++) state = tick(state)
  return state
}

describe('M2: spatial elections', () => {
  it('the election result is the sum of the communities (presence is real votes)', () => {
    // Two identical runs except one player camps in the biggest community building presence.
    const base = createGame(HOUSE_SPECIAL_PA07, SEED)
    const biggest = [...base.territory.communities].sort((a, b) => b.weight - a.weight)[0]!

    let grinder = base
    // Rally repeatedly at the media-market hub (starting location IS the biggest community).
    expect(grinder.territory.playerLocation).toBe(biggest.id)
    for (let i = 0; i < 10 && grinder.phase === 'campaign'; i++) {
      grinder = applyAction(grinder, { type: 'campaign/action', payload: { defId: 'rally' } })
      grinder = tick(grinder)
    }
    grinder = playOut(grinder)

    const idle = playOut(createGame(HOUSE_SPECIAL_PA07, SEED))
    const share = (s: GameState) => s.result!.sharesByCandidate[s.playerCandidateId] ?? 0
    expect(share(grinder)).toBeGreaterThan(share(idle))
  })

  it('spatial resolution is deterministic and conserves shares', () => {
    const a = playOut(createGame(HOUSE_SPECIAL_PA07, SEED))
    const b = playOut(createGame(HOUSE_SPECIAL_PA07, SEED))
    expect(a.result).toEqual(b.result)
    const total = Object.values(a.result!.sharesByCandidate).reduce((x, y) => x + y, 0)
    expect(total).toBeCloseTo(1, 6)
  })
})

describe('M2: hidden priorities & local opinion', () => {
  it('every community has a top issue derived from its real segment mix (deterministic)', () => {
    const t = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    for (const c of t.communities) expect(c.topIssueId).toBeTruthy()
    const t2 = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    expect(t2.communities.map((c) => c.topIssueId)).toEqual(t.communities.map((c) => c.topIssueId))
  })

  it('a direct-mail issue campaign shifts opinion ONLY in the community it lands in', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const here = s.territory.playerLocation
    s = applyAction(s, {
      type: 'campaign/runAd',
      payload: { channel: 'mail', tone: 'issue', policyId: 'public_option', budget: 2 },
    })
    expect(Object.keys(s.communityOpinion)).toEqual([here])
    expect(s.communityOpinion[here]!['healthcare']).not.toBe(0)
    expect(s.opinionShifts['healthcare'] ?? 0).toBe(0) // district-wide untouched
  })

  it("local opinion moves that community's measured support", () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const here = s.territory.playerLocation
    // canvass to measure, mail an issue campaign, re-canvass: local read should move
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'canvass' } })
    const before = s.territory.intel[here]!.playerShare
    s = { ...s, communityOpinion: { [here]: { healthcare: 0.16, abortion: 0.16, climate_energy: 0.16 } } }
    s = { ...s, territory: { ...s.territory, intel: {} }, campaign: { ...s.campaign, cooldowns: {}, actionPoints: 3 } }
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'canvass' } })
    const after = s.territory.intel[here]!.playerShare
    expect(after).not.toBe(before) // pro-player opinion shift changes the local split
  })
})

describe('M2: enthusiasm', () => {
  it('rallies build enthusiasm, which mobilizes your leaners (turnout boost grows)', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const boostOf = (state: GameState) => {
      const profiles = currentProfiles(state)
      const map = deriveTurnoutBoostMap(
        state.ledger,
        state.calendar.dayIndex,
        state.election.jurisdictionId,
        state.electorate.groups,
        profiles,
      )
      // Sum boost over groups leaning the player's way (D → positive lean).
      return state.electorate.groups
        .filter((g) => g.partisanLean > 0)
        .reduce((a, g) => a + (map[g.id] ?? 0), 0)
    }
    const before = boostOf(s)
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'rally' } })
    s = tick(s)
    expect(boostOf(s)).toBeGreaterThan(before)
  })
})
