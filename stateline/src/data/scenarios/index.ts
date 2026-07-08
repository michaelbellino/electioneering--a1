/**
 * Scenario registry — the roster of playable races. Each scenario is pure data (see houseSpecial.ts,
 * the template) over a real jurisdiction from the demographics snapshot. Difficulty stars are a
 * content rating of the FUNDAMENTALS for the scenario's default (Democratic-leaning) player; flip
 * party in the creator and an uphill race becomes a layup — that's the sandbox.
 */
import type { Scenario } from '../../engine/scenario'
import { buildPaRaces } from './pa'
import { HOUSE_SPECIAL_PA07 } from './houseSpecial'
import { TX13_OPEN_SEAT } from './txPanhandle'
import { NY13_PRIMARY_CHALLENGE } from './nyMachine'
import { PA_SENATE_SPRINT } from './paSenate'

export interface ScenarioMeta {
  readonly scenario: Scenario
  /** 1 (friendly) .. 5 (nearly unwinnable) for the default candidate. */
  readonly stars: number
  readonly tagline: string
  readonly blurb: string
}

export const SCENARIOS: readonly ScenarioMeta[] = [
  {
    scenario: HOUSE_SPECIAL_PA07,
    stars: 2,
    tagline: 'The Tossup',
    blurb:
      'A special election in a genuine 50/50 district. You face a better-known, better-funded opponent — but everything is winnable here.',
  },
  {
    scenario: NY13_PRIMARY_CHALLENGE,
    stars: 3,
    tagline: 'The Machine',
    blurb:
      'Upper Manhattan and the Bronx. The seat is safe blue — the fight is against the party machine’s hand-picked heir, who has every endorsement and every phone list.',
  },
  {
    scenario: TX13_OPEN_SEAT,
    stars: 5,
    tagline: 'The Panhandle',
    blurb:
      'The reddest open seat in Texas. As a Democrat this is a pilgrimage, not a campaign. As a Republican, try not to trip. Pick your fighter.',
  },
  {
    scenario: PA_SENATE_SPRINT,
    stars: 4,
    tagline: 'The Statewide Sprint',
    blurb:
      'All of Pennsylvania, thirteen million people, twenty weeks. Statewide races are won on money and name recognition — you start short on both.',
  },
] as const

/** The full Pennsylvania slate: every congressional district + Governor + US Senate. */
export const PA_RACES = buildPaRaces()

export function getScenario(id: string): Scenario {
  return (
    SCENARIOS.find((s) => s.scenario.id === id)?.scenario ??
    PA_RACES.find((r) => r.scenario.id === id)?.scenario ??
    HOUSE_SPECIAL_PA07
  )
}
