/**
 * Pure view-model selectors derived from GameState. Kept separate from components so they're unit-
 * testable without a DOM, and so components stay declarative.
 */
import { currentProfiles, type GameState } from '@engine/index'
import type { CampaignActionDef } from '@engine/campaign/types'
import type { Party } from '@engine/electorate/types'

export interface ActionAvailability {
  ok: boolean
  reason: string | null
}

export function actionAvailability(state: GameState, def: CampaignActionDef): ActionAvailability {
  if (state.phase !== 'campaign') return { ok: false, reason: 'Campaign over' }
  if (state.campaign.actionPoints < def.actionPointCost) return { ok: false, reason: 'No action points' }
  if (state.campaign.finance.cash < def.cashCost) return { ok: false, reason: 'Not enough cash' }
  const cd = state.campaign.cooldowns[def.id]
  if (cd !== undefined && state.calendar.dayIndex < cd) {
    const days = cd - state.calendar.dayIndex
    return { ok: false, reason: `Cooldown ${days}d` }
  }
  return { ok: true, reason: null }
}

export interface PollPoint {
  week: number
  player: number
  opponent: number
}

/** Two-way view (player vs strongest rival) — kept for compact readouts. */
export function pollSeries(state: GameState): PollPoint[] {
  return state.polls.map((p, i) => {
    const rivals = state.election.candidateIds.filter((id) => id !== state.playerCandidateId)
    const best = Math.max(0, ...rivals.map((id) => p.shares[id] ?? 0))
    return {
      week: i + 1,
      player: (p.shares[state.playerCandidateId] ?? 0) * 100,
      opponent: best * 100,
    }
  })
}

/** Full N-way poll series: one line per candidate. */
export function pollSeriesAll(
  state: GameState,
): Array<{ candidateId: string; name: string; party: Party; points: number[] }> {
  return state.election.candidateIds.map((id) => ({
    candidateId: id,
    name: state.candidates[id]?.name ?? id,
    party: state.candidates[id]?.party ?? 'I',
    points: state.polls.map((p) => (p.shares[id] ?? 0) * 100),
  }))
}

export function weeksToElection(state: GameState): number {
  return Math.max(0, Math.round((state.election.electionDay - state.calendar.dayIndex) / 7))
}

export interface Standing {
  candidateId: string
  name: string
  party: Party
  awareness: number
  favorability: number
}

export function standings(state: GameState): Standing[] {
  return currentProfiles(state).map((p) => ({
    candidateId: p.candidateId,
    name: state.candidates[p.candidateId]?.name ?? p.candidateId,
    party: p.party,
    awareness: p.awareness,
    favorability: p.favorability,
  }))
}

export function partyColor(party: Party): string {
  return party === 'D' ? '#4aa3ff' : party === 'R' ? '#ff6b6b' : '#b388ff'
}
