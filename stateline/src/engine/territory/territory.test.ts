import { describe, expect, it } from 'vitest'
import { applyAction, createGame, tick } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { PA_SENATE_SPRINT } from '../../data/scenarios/paSenate'
import { communityStandings } from './local'
import { currentProfiles } from '../reducer'
import { getCommunity } from './generate'

const SEED = 7

describe('territory generation', () => {
  it('is deterministic per seed, and different seeds make different maps', () => {
    const a = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    const b = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    const c = createGame(HOUSE_SPECIAL_PA07, SEED + 1).territory
    expect(b).toEqual(a)
    expect(JSON.stringify(c.communities)).not.toBe(JSON.stringify(a.communities))
  })

  it('district maps have 13 communities, statewide 19; weights sum to 1; graph is connected-ish', () => {
    const district = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    const state = createGame(PA_SENATE_SPRINT, SEED).territory
    expect(district.communities).toHaveLength(13)
    expect(state.communities).toHaveLength(19)
    const sum = district.communities.reduce((a, cm) => a + cm.weight, 0)
    expect(sum).toBeCloseTo(1, 6)
    for (const cm of district.communities) {
      expect(cm.neighbors.length).toBeGreaterThan(0)
      const segSum = Object.values(cm.segmentShares).reduce((a, b) => a + b, 0)
      expect(segSum).toBeCloseTo(1, 6)
    }
    // Names are unique.
    expect(new Set(district.communities.map((cm) => cm.name)).size).toBe(13)
  })

  it('urban cores lean bluer than rural country (emergent from the segment tilts)', () => {
    const t = createGame(HOUSE_SPECIAL_PA07, SEED).territory
    const urban = t.communities.filter((c) => c.archetype === 'urban')
    const rural = t.communities.filter((c) => c.archetype === 'rural')
    if (urban.length && rural.length) {
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      expect(avg(urban.map((c) => c.leanOffset))).toBeGreaterThan(avg(rural.map((c) => c.leanOffset)))
    }
  })
})

describe('travel & presence', () => {
  it('adjacent travel is free; cross-district jumps cost an action point', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const here = getCommunity(s.territory, s.territory.playerLocation)!
    const ap = s.campaign.actionPoints
    s = applyAction(s, { type: 'campaign/travel', payload: { communityId: here.neighbors[0]! } })
    expect(s.territory.playerLocation).toBe(here.neighbors[0])
    expect(s.campaign.actionPoints).toBe(ap)
    const far = s.territory.communities.find(
      (c) => c.id !== s.territory.playerLocation && !getCommunity(s.territory, s.territory.playerLocation)!.neighbors.includes(c.id),
    )!
    s = applyAction(s, { type: 'campaign/travel', payload: { communityId: far.id } })
    expect(s.territory.playerLocation).toBe(far.id)
    expect(s.campaign.actionPoints).toBe(ap - 1)
  })

  it('local actions build presence where you stand (and spill to neighbors); it decays weekly', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const here = s.territory.playerLocation
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'rally' } })
    const p = s.territory.presence[here] ?? 0
    expect(p).toBeGreaterThan(0)
    const neighbor = getCommunity(s.territory, here)!.neighbors[0]!
    expect(s.territory.presence[neighbor] ?? 0).toBeGreaterThan(0)
    expect(s.territory.presence[neighbor]!).toBeLessThan(p)
    const after = tick(s)
    expect(after.territory.presence[here] ?? 0).toBeLessThan(p)
  })

  it('canvassing gathers fog-of-war intel for the current community and its neighbors only', () => {
    let s = createGame(HOUSE_SPECIAL_PA07, SEED)
    expect(Object.keys(s.territory.intel)).toHaveLength(0)
    s = applyAction(s, { type: 'campaign/action', payload: { defId: 'canvass' } })
    const here = getCommunity(s.territory, s.territory.playerLocation)!
    expect(Object.keys(s.territory.intel).sort()).toEqual([s.territory.playerLocation, ...here.neighbors].sort())
    const intel = s.territory.intel[s.territory.playerLocation]!
    expect(intel.playerShare).toBeGreaterThan(0)
    expect(intel.playerShare).toBeLessThan(1)
  })

  it('the opponent moves around the map deterministically and builds presence', () => {
    const run = () => {
      let s = createGame(HOUSE_SPECIAL_PA07, SEED)
      const trail: string[] = []
      for (let i = 0; i < 10; i++) {
        s = tick(s)
        trail.push(s.territory.opponentLocation)
      }
      return { trail, presence: s.territory.oppPresence }
    }
    const a = run()
    const b = run()
    expect(b).toEqual(a)
    expect(Object.keys(a.presence).length).toBeGreaterThan(0)
  })

  it('community standings decompose the race across the map (shares sane, votes positive)', () => {
    const s = createGame(HOUSE_SPECIAL_PA07, SEED)
    const rows = communityStandings(s.electorate, currentProfiles(s), s.playerCandidateId, s.territory)
    expect(rows).toHaveLength(13)
    for (const r of rows) {
      expect(r.playerShare).toBeGreaterThanOrEqual(0)
      expect(r.playerShare).toBeLessThanOrEqual(1)
      expect(r.votes).toBeGreaterThan(0)
    }
    // Bluer communities give the (D) player more local share: correlation must be positive.
    const byLean = [...s.territory.communities].sort((a, b) => a.leanOffset - b.leanOffset)
    const share = (id: string) => rows.find((r) => r.communityId === id)!.playerShare
    expect(share(byLean[byLean.length - 1]!.id)).toBeGreaterThan(share(byLean[0]!.id))
  })
})
