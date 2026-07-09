/**
 * Statewide Pennsylvania — the big leagues. Nine million voters, a twenty-week runway, and a rich,
 * well-known opponent. Cash and name recognition dominate; the tycoon layer (staff, offices,
 * fundraising engine) is the whole game here.
 */
import type { Scenario } from '../../engine/scenario'

const USD = (d: number): number => Math.round(d * 100)

export const PA_SENATE_SPRINT: Scenario = {
  id: 'pa-senate-sprint',
  title: 'Pennsylvania Statewide',
  jurisdictionId: 'us-pa',
  startDate: { year: 2026, month: 4, day: 21 },
  electionDate: { year: 2026, month: 9, day: 8 },
  method: 'fptp',
  startingCash: USD(120_000),
  opponentIntensity: 0.55,
  player: {
    id: 'player',
    name: 'Your Candidate',
    party: 'D',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 },
    positions: {
      taxes_spending: 0.2,
      healthcare: 0.4,
      immigration: 0.1,
      guns: 0.1,
      abortion: 0.4,
      climate_energy: 0.3,
      crime_policing: 0,
      social_culture: 0.2,
    },
    baseExposure: 0.1,
    baseFavorability: 0,
  },
  opponent: {
    id: 'opponent',
    name: 'Gov. Chip Hartwell (R)',
    party: 'R',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.5, fundraising: 0.85 },
    positions: {
      taxes_spending: -0.5,
      healthcare: -0.4,
      immigration: -0.5,
      guns: -0.5,
      abortion: -0.4,
      climate_energy: -0.5,
      crime_policing: -0.5,
      social_culture: -0.4,
    },
    baseExposure: 0.75,
    baseFavorability: 0.08,
  },
}
