/**
 * The root reducer: the single channel through which the game advances. `applyAction` routes namespaced
 * player actions; `tick` advances one turn (a week). Both are pure — given the same state + input they
 * return the same new state — which is what makes the whole game replayable and testable.
 */
import { advanceCalendar, formatDate, type DayIndex } from './core/calendar'
import { popDue } from './core/events'
import { pruneLedger, type ScheduledEffect } from './core/ledger'
import { forkRng, Rng } from './core/rng'
import { formatUsd, type Action, type EntityId, type GamePhase } from './core/primitives'
import { getCampaignAction } from '../data/campaign/actions'
import { conductPoll } from './electorate/polling'
import type { CandidateProfile } from './electorate/types'
import {
  applyCampaignAction,
  tickCampaign,
} from './campaign/logic'
import { deriveCandidateProfile, deriveTurnoutBoostMap } from './campaign/profile'
import { resolveElection } from './electoral/resolve'
import { EVENT_ELECTION_DAY, type GameState, type PollRecord } from './state'

// --- Action union -----------------------------------------------------------
export type GameAction =
  | Action<'campaign/action', { defId: string }>
  | Action<'campaign/setStrategy', { tone?: number; focusIssue?: string | null }>
  | Action<'core/advanceTurn', Record<string, never>>

function bumpRevision(state: GameState): GameState['meta'] {
  return { ...state.meta, revision: state.meta.revision + 1 }
}

function opponentId(state: GameState): EntityId {
  return (
    Object.keys(state.candidates).find((id) => id !== state.playerCandidateId) ??
    state.playerCandidateId
  )
}

// --- Derived views ----------------------------------------------------------
function profilesAt(
  state: GameState,
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
): CandidateProfile[] {
  return state.election.candidateIds.map((id) => {
    const candidate = state.candidates[id]!
    return deriveCandidateProfile(candidate, state.election.jurisdictionId, ledger, day)
  })
}

function turnoutBoostAt(
  state: GameState,
  profiles: readonly CandidateProfile[],
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
): Record<string, number> {
  return deriveTurnoutBoostMap(
    ledger,
    day,
    state.election.jurisdictionId,
    state.electorate.groups,
    profiles,
  )
}

function conductPollRecord(
  state: GameState,
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
): PollRecord {
  const profiles = profilesAt(state, ledger, day)
  const rng = new Rng(forkRng(state.rng.polling!, `poll:${day}`))
  const poll = conductPoll(state.electorate, profiles, rng)
  return { day, shares: poll.shares, marginOfError: poll.marginOfError }
}

// --- Action handlers --------------------------------------------------------
function applyCampaignActionType(
  state: GameState,
  defId: string,
): GameState {
  if (state.phase !== 'campaign') return state
  const def = getCampaignAction(defId)
  const candidate = state.candidates[state.playerCandidateId]!
  if (!def) {
    return { ...state, meta: bumpRevision(state) }
  }
  const day = state.calendar.dayIndex
  const res = applyCampaignAction(state.campaign, candidate, def, {
    day,
    ledgerLength: state.ledger.length,
  })
  if (!res.ok) {
    return {
      ...state,
      meta: bumpRevision(state),
      log: [...state.log, { day, kind: 'action_blocked', message: res.errors[0]?.message ?? 'Blocked.' }],
    }
  }
  const raisedNote = res.raised > 0 ? ` (raised ${formatUsd(res.raised)})` : ''
  return {
    ...state,
    campaign: res.campaign,
    ledger: [...state.ledger, ...res.newEffects],
    meta: bumpRevision(state),
    log: [...state.log, { day, kind: 'action', message: `${candidate.name}: ${def.label}${raisedNote}` }],
  }
}

// --- Tick -------------------------------------------------------------------
function opponentEffects(state: GameState, day: DayIndex): ScheduledEffect[] {
  const intensity = state.aiOpponentIntensity
  if (intensity <= 0) return []
  const oppId = opponentId(state)
  const base = (suffix: string, channel: 'nameRecognition' | 'favorability', magnitude: number, decay: number) => ({
    id: `eff:ai:${oppId}:${day}:${suffix}`,
    target: { kind: 'electorate' as const, jurisdictionId: state.election.jurisdictionId, candidateId: oppId, channel },
    op: 'add' as const,
    magnitude,
    enactedDay: day,
    rampStartDays: 0,
    rampDurationDays: 3,
    decayHalfLifeDays: decay,
    sunsetDay: null,
    attributionActorId: oppId,
    sourceSubsystem: 'campaign' as const,
  })
  return [
    base('nr', 'nameRecognition', intensity, 30),
    base('fav', 'favorability', intensity * 0.08, 21),
  ]
}

export function tick(state: GameState): GameState {
  if (state.phase !== 'campaign') return state
  const calendar = advanceCalendar(state.calendar, 1)
  const day = calendar.dayIndex
  const candidate = state.candidates[state.playerCandidateId]!

  // Player upkeep + opponent campaigning.
  const tickRes = tickCampaign(state.campaign, candidate, calendar.daysPerTick)
  let ledger = [...state.ledger, ...opponentEffects(state, day)]

  // Fire due events (election day).
  const [due, eventQueue] = popDue(state.eventQueue, day)
  let result = state.result
  let phase: GamePhase = state.phase
  const extraLogs: GameState['log'][number][] = []
  for (const ev of due) {
    if (ev.kind === EVENT_ELECTION_DAY) {
      const profiles = profilesAt(state, ledger, day)
      const boost = turnoutBoostAt(state, profiles, ledger, day)
      const tieRng = new Rng(forkRng(state.rng.events!, `tie:${day}`))
      result = resolveElection(state.electorate, profiles, state.election.method, {
        turnoutBoost: boost,
        rng: tieRng,
      })
      phase = 'election_night'
      const won = result.winnerIds[0] === state.playerCandidateId
      extraLogs.push({
        day,
        kind: 'election',
        message: `Election held. You ${won ? 'WON' : 'LOST'} — margin ${(result.margin * 100).toFixed(1)} pts.`,
      })
    }
  }

  const poll = conductPollRecord(state, ledger, day)
  ledger = pruneLedger(ledger, day)

  return {
    ...state,
    calendar,
    campaign: tickRes.campaign,
    ledger,
    eventQueue,
    result,
    phase,
    polls: [...state.polls, poll],
    meta: bumpRevision(state),
    log: [
      ...state.log,
      { day, kind: 'week', message: `Advanced to ${formatDate(day)} — raised ${formatUsd(tickRes.raised)}.` },
      ...extraLogs,
    ],
  }
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'campaign/action':
      return applyCampaignActionType(state, action.payload.defId)
    case 'campaign/setStrategy':
      return {
        ...state,
        campaign: {
          ...state.campaign,
          strategy: {
            tone: action.payload.tone ?? state.campaign.strategy.tone,
            focusIssue: (action.payload.focusIssue ?? state.campaign.strategy.focusIssue) as never,
          },
        },
        meta: bumpRevision(state),
      }
    case 'core/advanceTurn':
      return tick(state)
    default:
      return state
  }
}

/** Live candidate profiles at the current day — for the UI to show name-rec/favorability/standing. */
export function currentProfiles(state: GameState): CandidateProfile[] {
  return profilesAt(state, state.ledger, state.calendar.dayIndex)
}
