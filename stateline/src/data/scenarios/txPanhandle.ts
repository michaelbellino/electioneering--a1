/**
 * TX-13 open seat — the Texas Panhandle, the reddest district in the roster (baseline lean ≈ R+70).
 * The default player is a Democrat, which makes this the "prove it" run; switch party in the creator
 * for an easy incumbent-party stroll instead.
 */
import type { Scenario } from '../../engine/scenario'

const USD = (d: number): number => Math.round(d * 100)

export const TX13_OPEN_SEAT: Scenario = {
  id: 'tx13-open-seat',
  title: 'TX-13 Open Seat',
  jurisdictionId: 'us-tx-cd13',
  startDate: { year: 2026, month: 5, day: 12 },
  electionDate: { year: 2026, month: 9, day: 1 },
  method: 'fptp',
  startingCash: USD(35_000),
  opponentIntensity: 0.3,
  player: {
    id: 'player',
    name: 'Your Candidate',
    party: 'D',
    attributes: { charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 },
    positions: {
      taxes_spending: 0.1,
      healthcare: 0.3,
      immigration: 0,
      guns: -0.2,
      abortion: 0.1,
      climate_energy: 0.1,
      crime_policing: -0.1,
      social_culture: 0,
    },
    baseExposure: 0.08,
    baseFavorability: 0,
  },
  opponent: {
    id: 'opponent',
    name: 'Rex Calloway (R)',
    party: 'R',
    attributes: { charisma: 0.5, competence: 0.45, integrity: 0.45, fundraising: 0.65 },
    positions: {
      taxes_spending: -0.7,
      healthcare: -0.6,
      immigration: -0.8,
      guns: -0.8,
      abortion: -0.7,
      climate_energy: -0.7,
      crime_policing: -0.6,
      social_culture: -0.7,
    },
    baseExposure: 0.5,
    baseFavorability: 0.05,
  },
}
