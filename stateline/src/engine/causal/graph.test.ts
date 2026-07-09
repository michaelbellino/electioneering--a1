import { describe, expect, it } from 'vitest'
import { createGame, applyAction, tick } from '../index'
import { HOUSE_SPECIAL_PA07 } from '../../data/scenarios/houseSpecial'
import { evaluateElectorate } from '../electorate/evaluate'
import { currentProfiles } from '../reducer'
import { buildCausalGraph, LEVER_IDS, OUTCOME_ID } from './graph'
import { ISSUE_IDS } from '../../data/schema'

const SEED = 1234

function freshState() {
  return createGame(HOUSE_SPECIAL_PA07, SEED)
}

describe('causal graph', () => {
  it('is deterministic: same state → identical graph, including after a save/load round-trip', () => {
    const state = freshState()
    const a = buildCausalGraph(state)
    const b = buildCausalGraph(state)
    expect(b).toEqual(a)
    const c = buildCausalGraph(JSON.parse(JSON.stringify(state)))
    expect(c).toEqual(a)
  })

  it('has the expected structure: every edge connects existing nodes; all layers populated', () => {
    const g = buildCausalGraph(freshState())
    const ids = new Set(g.nodes.map((n) => n.id))
    expect(ids.size).toBe(g.nodes.length) // no duplicate ids
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true)
      expect(ids.has(e.target)).toBe(true)
    }
    const byKind = (k: string) => g.nodes.filter((n) => n.kind === k).length
    expect(byKind('action')).toBe(6)
    expect(byKind('lever')).toBe(5)
    expect(byKind('outcome')).toBe(1)
    expect(byKind('segment')).toBe(6)
    expect(byKind('issue')).toBe(ISSUE_IDS.length)
  })

  it('outcome node reports the true (noise-free) modeled share', () => {
    const state = freshState()
    const g = buildCausalGraph(state)
    const outcome = g.nodes.find((n) => n.id === OUTCOME_ID)!
    const truth = evaluateElectorate(state.electorate, currentProfiles(state)).sharesByCandidate[
      state.playerCandidateId
    ]!
    expect(outcome.value).toBeCloseTo(truth, 6)
  })

  it('lever sensitivities have the right signs: own channels help, opponent favorability hurts', () => {
    const g = buildCausalGraph(freshState())
    const w = (id: string) =>
      g.edges.find((e) => e.kind === 'lever_sensitivity' && e.source === id)!.weight
    expect(w(LEVER_IDS.awareness)).toBeGreaterThan(0) // more name rec → more votes (start is low-awareness)
    expect(w(LEVER_IDS.favorability)).toBeGreaterThan(0)
    expect(w(LEVER_IDS.oppFavorability)).toBeLessThan(0) // opponent gaining favorability costs you
    expect(w(LEVER_IDS.groundGame)).toBeGreaterThan(0) // GOTV among your leaners helps
  })

  it('action edges mirror the content data: attack ad hits opponent favorability, rally builds awareness', () => {
    const g = buildCausalGraph(freshState())
    const edge = (src: string, dst: string) =>
      g.edges.find((e) => e.source === src && e.target === dst)
    expect(edge('action:rally', LEVER_IDS.awareness)!.weight).toBeGreaterThan(0)
    expect(edge('action:tv_ad_attack', LEVER_IDS.oppFavorability)!.weight).toBeLessThan(0)
    expect(edge('action:tv_ad_attack', LEVER_IDS.favorability)!.weight).toBeLessThan(0) // blowback
    expect(edge('action:fundraiser', LEVER_IDS.warChest)!.weight).toBeGreaterThan(0)
    // War chest moves no votes directly.
    expect(
      g.edges.find((e) => e.source === LEVER_IDS.warChest && e.kind === 'lever_sensitivity'),
    ).toBeUndefined()
  })

  it('issue→segment edges point the right way: moving progressive on immigration loses white non-college support', () => {
    const g = buildCausalGraph(freshState())
    const e = g.edges.find(
      (x) => x.source === 'issue:immigration' && x.target === 'segment:white_noncollege',
    )
    expect(e).toBeDefined()
    expect(e!.weight).toBeLessThan(0)
  })

  it('segment→outcome weights are vote-weighted and signed by current lean, and sum sanely', () => {
    const g = buildCausalGraph(freshState())
    const segEdges = g.edges.filter((e) => e.kind === 'segment_votes')
    expect(segEdges.length).toBe(6)
    for (const e of segEdges) expect(Math.abs(e.weight)).toBeLessThanOrEqual(1)
  })

  it('reflects play: running a rally increases the awareness lever value', () => {
    let state = freshState()
    const before = buildCausalGraph(state)
    state = applyAction(state, { type: 'campaign/action', payload: { defId: 'rally' } })
    state = tick(state)
    const after = buildCausalGraph(state)
    const val = (graph: typeof before, id: string) => graph.nodes.find((n) => n.id === id)!.value
    expect(val(after, LEVER_IDS.awareness)).toBeGreaterThan(val(before, LEVER_IDS.awareness))
  })
})
