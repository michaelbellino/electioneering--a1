/**
 * NY-13 — Upper Manhattan / the Bronx. Deep-blue seat where the real fight is the machine's chosen
 * successor: an Independent-labeled insurgency against a Democrat with every endorsement. High
 * awareness gap, low-turnout electorate — a persuasion-and-mobilization puzzle, not a base race.
 */
import type { Scenario } from '../../engine/scenario'

const USD = (d: number): number => Math.round(d * 100)

export const NY13_PRIMARY_CHALLENGE: Scenario = {
  id: 'ny13-machine',
  title: 'NY-13: Beat the Machine',
  jurisdictionId: 'us-ny-cd13',
  startDate: { year: 2026, month: 5, day: 26 },
  electionDate: { year: 2026, month: 9, day: 8 },
  method: 'fptp',
  startingCash: USD(40_000),
  opponentIntensity: 0.45,
  player: {
    id: 'player',
    name: 'Your Candidate',
    party: 'I',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 },
    positions: {
      taxes_spending: 0.5,
      healthcare: 0.6,
      immigration: 0.5,
      guns: 0.4,
      abortion: 0.5,
      climate_energy: 0.5,
      crime_policing: 0.4,
      social_culture: 0.5,
    },
    baseExposure: 0.12,
    baseFavorability: 0.02,
  },
  extraOpponents: [
    {
      id: 'also_ran',
      name: 'Gus Pomeroy (R)',
      party: 'R',
      attributes: { charisma: 0.4, competence: 0.45, integrity: 0.55, fundraising: 0.3 },
      positions: {
        taxes_spending: -0.5, healthcare: -0.4, immigration: -0.5, guns: -0.5,
        abortion: -0.4, climate_energy: -0.5, crime_policing: -0.5, social_culture: -0.5,
      },
      baseExposure: 0.15,
      baseFavorability: -0.02,
    },
  ],
  opponent: {
    id: 'opponent',
    name: 'Marisol Vega (D)',
    party: 'D',
    attributes: { charisma: 0.55, competence: 0.65, integrity: 0.5, fundraising: 0.75 },
    positions: {
      taxes_spending: 0.5,
      healthcare: 0.5,
      immigration: 0.5,
      guns: 0.5,
      abortion: 0.5,
      climate_energy: 0.4,
      crime_policing: 0.3,
      social_culture: 0.5,
    },
    baseExposure: 0.7,
    baseFavorability: 0.1,
  },
}
