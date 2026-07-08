/**
 * The root reducer: the single channel through which the game advances. `applyAction` routes namespaced
 * player actions; `tick` advances one turn (a week). Both are pure — given the same state + input they
 * return the same new state — which is what makes the whole game replayable and testable.
 */
import { advanceCalendar, formatDate, type DayIndex } from './core/calendar'
import { popDue } from './core/events'
import { pruneLedger, type ScheduledEffect } from './core/ledger'
import { forkRng, Rng } from './core/rng'
import { daysElapsed } from './core/calendar'
import { clamp, clamp01, formatUsd, type Action, type EntityId, type GamePhase } from './core/primitives'
import { getCampaignAction } from '../data/campaign/actions'
import { DILEMMAS, getDilemma } from '../data/campaign/dilemmas'
import { getDifficulty } from '../data/campaign/difficulties'
import { getHireableStaff, MAX_OFFICES, officeCost } from '../data/campaign/staff'
import { conductPoll } from './electorate/polling'
import type { CandidateProfile } from './electorate/types'
import {
  applyCampaignAction,
  staffEffectiveness,
  tickCampaign,
} from './campaign/logic'
import { getDilemmaOption, pickDilemma, type DilemmaDef, type DilemmaOption } from './campaign/dilemmas'
import { lowerEffects } from './campaign/pipeline'
import { canAfford, raise, spend } from './campaign/finance'
import { deriveCandidateProfile, deriveTurnoutBoostMap } from './campaign/profile'
import { areAdjacent, getCommunity, type TerritoryState } from './territory/generate'
import { communityElectorate, localProfiles } from './territory/local'
import { evaluateElectorate } from './electorate/evaluate'
import { resolveElection } from './electoral/resolve'
import { EVENT_ELECTION_DAY, type GameState, type PollRecord } from './state'

// --- Action union -----------------------------------------------------------
export type GameAction =
  | Action<'campaign/action', { defId: string }>
  | Action<'campaign/setStrategy', { tone?: number; focusIssue?: string | null }>
  | Action<'campaign/hireStaff', { staffId: string }>
  | Action<'campaign/fireStaff', { staffId: string }>
  | Action<'campaign/openOffice', Record<string, never>>
  | Action<'campaign/resolveDilemma', { optionId: string }>
  | Action<'campaign/travel', { communityId: string }>
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
  // A pollster on staff buys bigger samples: tighter margin of error.
  const sampleSize = Math.round(600 + 1600 * staffEffectiveness(state.campaign, 'pollster'))
  const poll = conductPoll(state.electorate, profiles, rng, { sampleSize })
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
  const here = state.territory.playerLocation
  const isLocal = LOCAL_CATEGORIES.has(def.category)
  const res = applyCampaignAction(state.campaign, candidate, def, {
    day,
    ledgerLength: state.ledger.length,
    extraMultiplier: isLocal ? localReach(state.territory, here) : 1,
  })
  if (!res.ok) {
    return {
      ...state,
      meta: bumpRevision(state),
      log: [...state.log, { day, kind: 'action_blocked', message: res.errors[0]?.message ?? 'Blocked.' }],
    }
  }

  // Local actions build ground presence where you stand; canvassing also gathers intel.
  let territory = state.territory
  if (isLocal) {
    territory = { ...territory, presence: bumpPresence(territory.presence, territory, here, 0.35) }
  }
  if (def.id === 'canvass') {
    const hereCommunity = getCommunity(territory, here)
    const targets = [here, ...(hereCommunity?.neighbors ?? [])]
    const intel = { ...territory.intel }
    for (const id of targets) {
      intel[id] = { day, playerShare: measureCommunity(state, id, day) }
    }
    territory = { ...territory, intel }
  }

  const whereNote = isLocal ? ` in ${getCommunity(territory, here)?.name ?? 'town'}` : ''
  const raisedNote = res.raised > 0 ? ` (raised ${formatUsd(res.raised)})` : ''
  return {
    ...state,
    campaign: res.campaign,
    territory,
    ledger: [...state.ledger, ...res.newEffects],
    meta: bumpRevision(state),
    log: [
      ...state.log,
      { day, kind: 'action', message: `${candidate.name}: ${def.label}${whereNote}${raisedNote}` },
    ],
  }
}

// --- Territory (the map layer) -----------------------------------------------
/** Local categories happen WHERE the candidate stands; broadcast categories don't care. */
const LOCAL_CATEGORIES = new Set(['event', 'ground_game', 'message'])

/** Reach multiplier for acting in a community: a rally downtown beats a rally at a crossroads. */
function localReach(territory: TerritoryState, communityId: string): number {
  const c = getCommunity(territory, communityId)
  if (!c) return 1
  return Math.min(1.5, 0.6 + c.weight * 4.5)
}

function bumpPresence(
  presence: Readonly<Record<string, number>>,
  territory: TerritoryState,
  at: string,
  amount: number,
): Record<string, number> {
  const next: Record<string, number> = { ...presence }
  const here = getCommunity(territory, at)
  next[at] = Math.min(1, (next[at] ?? 0) + amount)
  for (const n of here?.neighbors ?? []) {
    next[n] = Math.min(1, (next[n] ?? 0) + amount * 0.35)
  }
  return next
}

/** Measure the player's local support in a community RIGHT NOW (used for canvass intel). */
function measureCommunity(state: GameState, communityId: string, day: DayIndex): number {
  const c = getCommunity(state.territory, communityId)
  if (!c) return 0
  const profiles = profilesAt(state, state.ledger, day)
  const local = evaluateElectorate(
    communityElectorate(state.electorate, c),
    localProfiles(profiles, state.playerCandidateId, c, state.territory),
  )
  return local.sharesByCandidate[state.playerCandidateId] ?? 0
}

function travel(state: GameState, communityId: string): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const dest = getCommunity(state.territory, communityId)
  if (!dest || communityId === state.territory.playerLocation) return state
  const adjacent = areAdjacent(state.territory, state.territory.playerLocation, communityId)
  const apCost = adjacent ? 0 : 1
  if (state.campaign.actionPoints < apCost)
    return blocked(state, day, 'A cross-district bus tour takes an action point.')
  return {
    ...state,
    territory: { ...state.territory, playerLocation: communityId },
    campaign: { ...state.campaign, actionPoints: state.campaign.actionPoints - apCost },
    meta: bumpRevision(state),
    log: [
      ...state.log,
      {
        day,
        kind: 'travel',
        message: `${adjacent ? 'Drove over' : 'Bus tour'} to ${dest.name}.`,
      },
    ],
  }
}

/** Opponent moves along the map each week and builds presence where they go. */
function tickOpponentTerritory(state: GameState, day: DayIndex): TerritoryState {
  const t = state.territory
  const rng = new Rng(forkRng(state.rng.ai!, `move:${day}`))
  const here = getCommunity(t, t.opponentLocation)
  // Weighted hop: bigger neighbors pull harder; sometimes they barnstorm (jump anywhere).
  const options = [t.opponentLocation, ...(here?.neighbors ?? [])]
  const jump = rng.bool(0.2)
  const pool = jump ? t.communities.map((c) => c.id) : options
  const weights = pool.map((id) => getCommunity(t, id)?.weight ?? 0.01)
  const total = weights.reduce((a, b) => a + b, 0)
  let x = rng.float() * total
  let dest = pool[pool.length - 1]!
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i]!
    if (x < 0) {
      dest = pool[i]!
      break
    }
  }
  const decayed = (m: Readonly<Record<string, number>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * 0.75]).filter(([, v]) => (v as number) > 0.01))
  return {
    ...t,
    opponentLocation: dest,
    presence: decayed(t.presence),
    oppPresence: bumpPresence(decayed(t.oppPresence), t, dest, 0.3 * Math.min(1.5, 0.5 + state.aiOpponentIntensity)),
  }
}

// --- Staff & offices (tycoon layer) ------------------------------------------
function blocked(state: GameState, day: DayIndex, message: string): GameState {
  return {
    ...state,
    meta: bumpRevision(state),
    log: [...state.log, { day, kind: 'action_blocked', message }],
  }
}

function hireStaff(state: GameState, staffId: string): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const def = getHireableStaff(staffId)
  if (!def) return blocked(state, day, 'Unknown hire.')
  if (state.campaign.staff.some((s) => s.id === def.id))
    return blocked(state, day, `${def.name} already works for you.`)
  if (state.campaign.staff.some((s) => s.role === def.role))
    return blocked(state, day, `You already have a ${def.role.replace('_', ' ')}.`)
  if (state.campaign.actionPoints < 1)
    return blocked(state, day, 'Hiring takes an action point — none left this week.')
  if (!canAfford(state.campaign.finance, def.signingBonus))
    return blocked(state, day, 'Not enough cash for the signing bonus.')

  const isManager = def.role === 'manager'
  return {
    ...state,
    campaign: {
      ...state.campaign,
      finance: spend(state.campaign.finance, def.signingBonus),
      actionPoints: state.campaign.actionPoints - 1 + (isManager ? 1 : 0),
      maxActionPoints: state.campaign.maxActionPoints + (isManager ? 1 : 0),
      staff: [
        ...state.campaign.staff,
        { id: def.id, role: def.role, weeklySalary: def.weeklySalary, effectiveness: def.effectiveness },
      ],
    },
    meta: bumpRevision(state),
    log: [
      ...state.log,
      { day, kind: 'action', message: `Hired ${def.name} (${formatUsd(def.weeklySalary)}/wk).` },
    ],
  }
}

function fireStaff(state: GameState, staffId: string): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const member = state.campaign.staff.find((s) => s.id === staffId)
  if (!member) return state
  const def = getHireableStaff(staffId)
  const isManager = member.role === 'manager'
  return {
    ...state,
    campaign: {
      ...state.campaign,
      staff: state.campaign.staff.filter((s) => s.id !== staffId),
      maxActionPoints: Math.max(1, state.campaign.maxActionPoints - (isManager ? 1 : 0)),
      actionPoints: Math.min(
        state.campaign.actionPoints,
        Math.max(1, state.campaign.maxActionPoints - (isManager ? 1 : 0)),
      ),
    },
    meta: bumpRevision(state),
    log: [...state.log, { day, kind: 'action', message: `Let ${def?.name ?? 'a staffer'} go.` }],
  }
}

function openOffice(state: GameState): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const owned = state.campaign.offices
  if (owned >= MAX_OFFICES) return blocked(state, day, 'You already cover the whole district.')
  const cost = officeCost(owned)
  if (state.campaign.actionPoints < 1)
    return blocked(state, day, 'Opening an office takes an action point.')
  if (!canAfford(state.campaign.finance, cost))
    return blocked(state, day, 'Not enough cash for the lease.')
  return {
    ...state,
    campaign: {
      ...state.campaign,
      finance: spend(state.campaign.finance, cost),
      actionPoints: state.campaign.actionPoints - 1,
      offices: owned + 1,
    },
    meta: bumpRevision(state),
    log: [
      ...state.log,
      { day, kind: 'action', message: `Opened field office #${owned + 1} (${formatUsd(cost)}).` },
    ],
  }
}

// --- Dilemmas (roguelike layer) ----------------------------------------------
/** Apply one dilemma option's consequences. Pure; used by both manual and auto resolution. */
function applyDilemmaResolution(
  state: GameState,
  def: DilemmaDef,
  option: DilemmaOption,
  auto: boolean,
): GameState {
  const day = state.calendar.dayIndex
  const player = state.candidates[state.playerCandidateId]!
  let campaign = state.campaign
  let candidates = state.candidates
  let ledger = state.ledger
  const logs: GameState['log'] = []

  const applyConsequence = (c: DilemmaOption['consequence']): void => {
    if (c.cashDelta) {
      campaign = {
        ...campaign,
        finance:
          c.cashDelta > 0
            ? raise(campaign.finance, c.cashDelta)
            : spend(campaign.finance, -c.cashDelta),
      }
    }
    if (c.apDelta) {
      campaign = { ...campaign, actionPoints: Math.max(0, campaign.actionPoints + c.apDelta) }
    }
    if (c.scandal) {
      const targetId = c.scandal.target === 'self' ? state.playerCandidateId : opponentId(state)
      const mult = c.scandal.target === 'self' ? campaign.modifiers.scandalMult : 1
      const target = candidates[targetId]!
      candidates = {
        ...candidates,
        [targetId]: {
          ...target,
          scandalLoad: clamp01(target.scandalLoad + c.scandal.amount * mult),
        },
      }
    }
    if (c.positionShifts) {
      const positions = { ...player.positions }
      for (const shift of c.positionShifts) {
        positions[shift.issueId] = clamp((positions[shift.issueId] ?? 0) + shift.delta, -1, 1)
      }
      candidates = {
        ...candidates,
        [state.playerCandidateId]: { ...candidates[state.playerCandidateId]!, positions },
      }
    }
    if (c.effects && c.effects.length > 0) {
      ledger = [
        ...ledger,
        ...lowerEffects(
          { id: `dilemma:${def.id}:${option.id}`, effects: c.effects },
          {
            candidateId: state.playerCandidateId,
            opponentId: opponentId(state),
            jurisdictionId: state.election.jurisdictionId,
            day,
            ledgerLength: ledger.length,
            multiplier: 1,
          },
        ),
      ]
    }
  }

  applyConsequence(option.consequence)
  let resultText = option.resultText

  if (option.risk) {
    const rng = new Rng(forkRng(state.rng.events!, `dilemma:${def.id}:${option.id}:${day}`))
    const mitigation = option.risk.mitigatedBy ? player.attributes[option.risk.mitigatedBy] : 0
    const chance = option.risk.chance * (1 - mitigation)
    if (rng.bool(chance)) {
      applyConsequence(option.risk.onFail)
      resultText = option.risk.failText
    }
  }

  logs.push({
    day,
    kind: 'dilemma',
    message: `${def.title}: ${auto ? '(let it slide) ' : ''}${resultText}`,
  })

  return {
    ...state,
    campaign,
    candidates,
    ledger,
    pendingDilemma: null,
    log: [...state.log, ...logs],
  }
}

function resolveDilemmaAction(state: GameState, optionId: string): GameState {
  if (!state.pendingDilemma) return state
  const def = getDilemma(state.pendingDilemma.defId)
  if (!def) return { ...state, pendingDilemma: null, meta: bumpRevision(state) }
  const option = getDilemmaOption(def, optionId)
  const next = applyDilemmaResolution(state, def, option, false)
  return { ...next, meta: bumpRevision(state) }
}

/** On tick: auto-resolve an ignored dilemma with its default option, then maybe draw a new one. */
function tickDilemmas(state: GameState, day: DayIndex): GameState {
  let next = state
  if (next.pendingDilemma) {
    const def = getDilemma(next.pendingDilemma.defId)
    next = def
      ? applyDilemmaResolution(next, def, getDilemmaOption(def, def.defaultOptionId), true)
      : { ...next, pendingDilemma: null }
  }
  if (next.phase !== 'campaign') return next

  const difficulty = getDifficulty(next.meta.difficulty)
  const rng = new Rng(forkRng(next.rng.events!, `dilemma-draw:${day}`))
  const week = Math.floor(daysElapsed(next.calendar) / 7)
  if (week < 2 || !rng.bool(difficulty.dilemmaChance)) return next

  const def = pickDilemma(DILEMMAS, next.seenDilemmas, week, rng.float())
  if (!def) return next
  return {
    ...next,
    pendingDilemma: { defId: def.id, day },
    seenDilemmas: [...next.seenDilemmas, def.id],
    log: [...next.log, { day, kind: 'dilemma', message: `On your desk: ${def.title}.` }],
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

  const advanced: GameState = {
    ...state,
    calendar,
    territory: tickOpponentTerritory(state, day),
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
  // Dilemmas: auto-resolve last week's ignored one, then maybe land a new one on the desk.
  return tickDilemmas(advanced, day)
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
    case 'campaign/hireStaff':
      return hireStaff(state, action.payload.staffId)
    case 'campaign/fireStaff':
      return fireStaff(state, action.payload.staffId)
    case 'campaign/openOffice':
      return openOffice(state)
    case 'campaign/resolveDilemma':
      return resolveDilemmaAction(state, action.payload.optionId)
    case 'campaign/travel':
      return travel(state, action.payload.communityId)
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
