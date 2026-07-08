import { describe, expect, it } from 'vitest'
import { HOUSE_SPECIAL_PA07 } from '../data/scenarios/houseSpecial'
import { Engine } from './index'

const WEEKLY_PLAN = ['tv_ad_positive', 'speech', 'fundraiser'] as const

function playWeek(engine: Engine): void {
  for (const defId of WEEKLY_PLAN) {
    engine.dispatch({ type: 'campaign/action', payload: { defId } })
  }
  engine.advanceTurn()
}

function playToElection(engine: Engine): void {
  let guard = 0
  while (engine.getState().phase === 'campaign' && guard++ < 100) {
    playWeek(engine)
  }
}

describe('end-to-end: a full PA-07 campaign', () => {
  it('runs from candidate creation through election night', () => {
    const engine = Engine.create(HOUSE_SPECIAL_PA07, 12345)
    expect(engine.getState().phase).toBe('campaign')

    const startAwareness = engine.profiles().find((p) => p.candidateId === 'player')!.awareness

    playToElection(engine)
    const s = engine.getState()

    expect(s.phase).toBe('election_night')
    expect(s.result).not.toBeNull()
    expect(s.result!.winnerIds).toHaveLength(1)
    expect(['player', 'opponent']).toContain(s.result!.winnerIds[0])
    expect(s.polls.length).toBeGreaterThan(5)

    // Campaigning raised the player's name recognition over the race.
    const endAwareness = engine.profiles().find((p) => p.candidateId === 'player')!.awareness
    expect(endAwareness).toBeGreaterThan(startAwareness)
  })

  it('out-campaigning a passive opponent wins the tossup', () => {
    // Player runs 3 actions/week; the AI opponent campaigns at low intensity. In a true tossup that
    // should be enough to win — a sanity check that campaign effort actually moves the result.
    const engine = Engine.create(HOUSE_SPECIAL_PA07, 2026)
    playToElection(engine)
    expect(engine.getState().result!.winnerIds[0]).toBe('player')
  })
})

describe('determinism & save/load', () => {
  it('replays byte-identically for the same seed + script', () => {
    const run = () => {
      const e = Engine.create(HOUSE_SPECIAL_PA07, 99)
      playToElection(e)
      return e.serialize()
    }
    expect(run()).toBe(run())
  })

  it('produces different games for different seeds (polling noise differs)', () => {
    const a = (() => {
      const e = Engine.create(HOUSE_SPECIAL_PA07, 1)
      playToElection(e)
      return e.serialize()
    })()
    const b = (() => {
      const e = Engine.create(HOUSE_SPECIAL_PA07, 2)
      playToElection(e)
      return e.serialize()
    })()
    expect(a).not.toBe(b)
  })

  it('serialize → deserialize → continue equals an uninterrupted run', () => {
    const seed = 7
    const full = Engine.create(HOUSE_SPECIAL_PA07, seed)
    playToElection(full)
    const fullSerialized = full.serialize()

    const partial = Engine.create(HOUSE_SPECIAL_PA07, seed)
    playWeek(partial)
    playWeek(partial)
    playWeek(partial)
    const saved = partial.serialize()

    const resumed = Engine.deserialize(saved)
    playToElection(resumed)

    expect(resumed.serialize()).toBe(fullSerialized)
  })
})
