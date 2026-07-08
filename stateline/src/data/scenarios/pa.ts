/**
 * The Pennsylvania slate: a playable race for every PA congressional district plus both statewide
 * offices, GENERATED deterministically from the demographics data (no hand-authored scenario per
 * district). Opponent strength, positions, and money all derive from the seat's real lean — a safe
 * seat's incumbent party fields a strong, dug-in opponent; a tossup fields a peer.
 */
import type { Scenario, ScenarioCandidate } from '../../engine/scenario'
import { dateToDayIndex, dayIndexToDate } from '../../engine/core/calendar'
import type { IssueId } from '../schema'
import { ISSUE_IDS } from '../schema'
import { DEMOGRAPHICS_SEED } from '../datasets/demographics.seed'

const USD = (d: number): number => Math.round(d * 100)

const R_NAMES = ['Hank Voss (R)', 'Carol Brandt (R)', 'Denny Kessler (R)', 'Rick Stover (R)', 'June Alderman (R)', 'Walt Hering (R)']
const D_NAMES = ['Renee Calloway (D)', 'Marcus Bell (D)', 'Tricia Novak (D)', 'Omar Reyes (D)', 'Ellen Marsh (D)', 'Sam Okafor (D)']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function opponentFor(jurisdictionId: string, lean: number, statewide: boolean): ScenarioCandidate {
  // The seat's favored party defends it. Deep-blue seats get a machine Democrat (you run as an
  // independent-minded challenger); everything else gets a Republican.
  const machine = lean > 0.3
  const party = machine ? ('D' as const) : ('R' as const)
  const names = machine ? D_NAMES : R_NAMES
  const dir = machine ? 1 : -1
  const strength = Math.min(1, Math.abs(lean)) // dug-in seats breed strong incumbents
  const positions = Object.fromEntries(
    ISSUE_IDS.map((id) => [id, dir * (0.3 + 0.45 * strength)]),
  ) as Record<IssueId, number>
  return {
    id: 'opponent',
    name: names[hash(jurisdictionId) % names.length]!,
    party,
    attributes: {
      charisma: 0.5 + 0.1 * strength,
      competence: 0.5 + 0.1 * strength,
      integrity: 0.5,
      fundraising: 0.55 + 0.3 * strength + (statewide ? 0.1 : 0),
    },
    positions,
    baseExposure: 0.45 + 0.3 * strength + (statewide ? 0.1 : 0),
    baseFavorability: 0.03 + 0.05 * strength,
  }
}

function playerDefaults(lean: number): ScenarioCandidate {
  const machine = lean > 0.3
  return {
    id: 'player',
    name: 'Your Candidate',
    party: machine ? 'I' : 'D',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 },
    positions: Object.fromEntries(ISSUE_IDS.map((id) => [id, machine ? 0.4 : 0.2])) as Record<IssueId, number>,
    baseExposure: 0.1,
    baseFavorability: 0,
  }
}

export interface PaRaceMeta {
  readonly scenario: Scenario
  readonly stars: number
  readonly group: 'district' | 'statewide'
}

function starsFor(lean: number): number {
  const a = Math.abs(lean)
  if (lean > 0.3) return 3 // machine primary fights are their own animal
  if (a < 0.08) return 2
  if (lean > 0) return 1
  return a < 0.25 ? 3 : a < 0.5 ? 4 : 5
}

export function buildPaRaces(): PaRaceMeta[] {
  const districts = DEMOGRAPHICS_SEED.jurisdictions.filter(
    (j) => j.parentId === 'us-pa' && j.level === 'congressional_district',
  )
  const races: PaRaceMeta[] = districts
    .sort((a, b) => a.geoid.localeCompare(b.geoid))
    .map((j) => ({
      group: 'district' as const,
      stars: starsFor(j.baselinePartisanLean),
      scenario: {
        id: `race:${j.id}`,
        title: j.name,
        jurisdictionId: j.id,
        startDate: { year: 2026, month: 5, day: 19 },
        electionDate: { year: 2026, month: 9, day: 15 },
        method: 'fptp' as const,
        startingCash: USD(50_000),
        opponentIntensity: 0.3 + 0.25 * Math.min(1, Math.abs(j.baselinePartisanLean)),
        player: playerDefaults(j.baselinePartisanLean),
        opponent: opponentFor(j.id, j.baselinePartisanLean, false),
      },
    }))

  const pa = DEMOGRAPHICS_SEED.jurisdictions.find((j) => j.id === 'us-pa')!
  const statewide = (office: string, cash: number, weeks: number): PaRaceMeta => {
    const startDate = { year: 2026, month: 4, day: 14 }
    return {
      group: 'statewide',
      stars: 4,
      scenario: {
        id: `race:us-pa:${office.toLowerCase().replace(/\s/g, '-')}`,
        title: `Pennsylvania ${office}`,
        jurisdictionId: 'us-pa',
        startDate,
        electionDate: dayIndexToDate(dateToDayIndex(startDate) + weeks * 7),
        method: 'fptp' as const,
        startingCash: USD(cash),
        opponentIntensity: 0.55,
        player: playerDefaults(pa.baselinePartisanLean),
        opponent: opponentFor(`us-pa:${office}`, pa.baselinePartisanLean, true),
      },
    }
  }
  return [...races, statewide('Governor', 220_000, 22), statewide('US Senate', 160_000, 20)]
}
