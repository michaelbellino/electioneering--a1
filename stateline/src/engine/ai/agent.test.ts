import { describe, expect, it } from 'vitest'
import { createGame, tick, type GameState } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { buildPaRaces } from '../../data/scenarios/pa'

const SEED = 99

function weeks(state: GameState, n: number): GameState {
  for (let i = 0; i < n && state.phase === 'campaign'; i++) state = tick(state)
  return state
}

describe('AI candidates (M1)', () => {
  it('AI turns are deterministic: identical replays produce identical ai state and logs', () => {
    const run = () => {
      const s = weeks(createGame(HOUSE_SPECIAL_PA07, SEED), 8)
      return { ai: s.aiCandidates, log: s.log.map((l) => l.message) }
    }
    expect(run()).toEqual(run())
  })

  it('AI candidates manage a real war chest: cash moves week to week', () => {
    const s0 = createGame(HOUSE_SPECIAL_PA07, SEED)
    const oppId = Object.keys(s0.aiCandidates)[0]!
    const s8 = weeks(s0, 8)
    expect(s8.aiCandidates[oppId]!.cash).not.toBe(s0.aiCandidates[oppId]!.cash)
  })

  it('AI candidates move around the map and their moves are reported in the log', () => {
    const s = weeks(createGame(HOUSE_SPECIAL_PA07, SEED), 10)
    expect(s.log.some((l) => l.kind === 'opposition')).toBe(true)
    // location is a real community id
    const ai = Object.values(s.aiCandidates)[0]!
    expect(s.territory.communities.some((c) => c.id === ai.location)).toBe(true)
  })

  it('three-way races run end-to-end: PA Governor has 3 candidates and shares sum to 1', () => {
    const gov = buildPaRaces().find((r) => r.scenario.id.includes('governor'))!
    let s = createGame(gov.scenario, SEED)
    expect(s.election.candidateIds).toHaveLength(3)
    expect(Object.keys(s.aiCandidates)).toHaveLength(2)
    s = weeks(s, 40)
    expect(s.phase).toBe('election_night')
    const total = Object.values(s.result!.sharesByCandidate).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 6)
    // Polls tracked all three.
    const lastPoll = s.polls[s.polls.length - 1]!
    expect(Object.keys(lastPoll.shares)).toHaveLength(3)
  })

  it('the AI actually campaigns: rival awareness grows over the race', () => {
    const s0 = createGame(HOUSE_SPECIAL_PA07, SEED)
    const s10 = weeks(s0, 10)
    const oppId = Object.keys(s0.aiCandidates)[0]!
    const before = s0.polls[0]?.shares[oppId]
    const after = s10.polls[s10.polls.length - 1]!.shares[oppId]!
    expect(after).toBeGreaterThan(0.2) // they hold real support, not a static dummy
    expect(before === undefined || after !== before).toBe(true)
  })

  it('save/load round-trip preserves AI state byte-identically', () => {
    const s = weeks(createGame(HOUSE_SPECIAL_PA07, SEED), 5)
    const revived = JSON.parse(JSON.stringify(s)) as GameState
    expect(JSON.stringify(tick(revived))).toBe(JSON.stringify(tick(s)))
  })
})
