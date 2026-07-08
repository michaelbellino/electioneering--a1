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
