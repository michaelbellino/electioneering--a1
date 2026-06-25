/**
 * The first playable scenario: a special election for Pennsylvania's 7th Congressional District — a
 * genuine tossup (calibrated to ~50/50). You (a Democrat) face a better-known, better-funded Republican.
 * Win by out-campaigning them over the summer.
 *
 * Scenarios are data — this is also the template a modder copies to author a new race.
 */
import type { Scenario } from '../../engine/scenario'

const USD = (d: number): number => Math.round(d * 100)

export const HOUSE_SPECIAL_PA07: Scenario = {
  id: 'house-special-pa07',
  title: 'PA-07 Special Election',
  jurisdictionId: 'us-pa-cd07',
  startDate: { year: 2026, month: 6, day: 2 },
  electionDate: { year: 2026, month: 9, day: 15 },
  method: 'fptp',
  startingCash: USD(50_000),
  opponentIntensity: 0.35,
  player: {
    id: 'player',
    name: 'Your Candidate',
    party: 'D',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 },
    positions: {
      taxes_spending: 0.2,
      healthcare: 0.4,
      immigration: 0.2,
      guns: 0.2,
      abortion: 0.5,
      climate_energy: 0.4,
      crime_policing: 0.1,
      social_culture: 0.3,
    },
    baseExposure: 0.1,
    baseFavorability: 0,
  },
  opponent: {
    id: 'opponent',
    name: 'Dale Whitaker (R)',
    party: 'R',
    attributes: { charisma: 0.55, competence: 0.6, integrity: 0.5, fundraising: 0.7 },
    positions: {
      taxes_spending: -0.4,
      healthcare: -0.3,
      immigration: -0.6,
      guns: -0.5,
      abortion: -0.4,
      climate_energy: -0.4,
      crime_policing: -0.4,
      social_culture: -0.5,
    },
    baseExposure: 0.6,
    baseFavorability: 0.05,
  },
}
