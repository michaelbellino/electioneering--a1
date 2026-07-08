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
import { AD_FATIGUE_RATE, ATTACK_BACKFIRE_THRESHOLD, OPINION_SHIFT_CAP, adCost, getAdChannel } from '../data/campaign/advertising'
import { getPolicy, POLICIES } from '../data/policies'
import { ISSUE_DEFS, SEGMENT_DEFS } from '../data/voterModel'
import { agreementShare, shiftedElectorate } from './electorate/opinion'
import type { ElectorateState } from './electorate/types'
import { areAdjacent, getCommunity, type TerritoryState } from './territory/generate'
import { communityElectorate, localProfiles } from './territory/local'
import { evaluateElectorate } from './electorate/evaluate'
import { runAiTurn } from './ai/agent'
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
  | Action<'campaign/runAd', { channel: string; tone: string; policyId?: string; budget: number }>
  | Action<'campaign/commissionPoll', { kind: string }>
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
/** The electorate as it stands TODAY: base data + opinion shifts won by issue advertising. */
export function effectiveElectorate(state: GameState): ElectorateState {
  return shiftedElectorate(state.electorate, state.opinionShifts)
}
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
  const poll = conductPoll(effectiveElectorate(state), profiles, rng, { sampleSize })
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
  return Math.min(1.3, 0.55 + c.weight * 4)
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
    communityElectorate(effectiveElectorate(state), c, state.communityOpinion[communityId]),
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

// --- Advertising & polling (the media war) ------------------------------------
function runAd(
  state: GameState,
  payload: { channel: string; tone: string; policyId?: string; budget: number },
): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const channel = getAdChannel(payload.channel)
  if (!channel) return blocked(state, day, 'Unknown ad channel.')
  const budget = Math.max(1, Math.min(3, Math.round(payload.budget))) as 1 | 2 | 3
  const policy = payload.policyId ? getPolicy(payload.policyId) : undefined
  if ((payload.tone === 'attack' || payload.tone === 'issue') && !policy)
    return blocked(state, day, 'Pick the policy this ad is about.')
  const cost = Math.round(
    adCost(channel, budget, state.electorate.cvap) *
      (channel.id === 'digital' && staffEffectiveness(state.campaign, 'digital_director') > 0 ? 0.7 : 1),
  )
  if (state.campaign.actionPoints < 1) return blocked(state, day, 'No action points left this week.')
  if (!canAfford(state.campaign.finance, cost)) return blocked(state, day, 'Not enough cash for that buy.')

  const fatigueN = state.campaign.adFatigue[channel.id] ?? 0
  const fatigueMult = 1 / (1 + AD_FATIGUE_RATE * fatigueN)
  const commsAmp = 1 + staffEffectiveness(state.campaign, 'comms_director') * 0.35
  const digitalAmp = channel.id === 'digital' ? 1 + staffEffectiveness(state.campaign, 'digital_director') * 0.4 : 1
  const power = budget * fatigueMult * commsAmp * digitalAmp
  const player = state.candidates[state.playerCandidateId]!
  const opp = state.candidates[opponentId(state)]!
  let communityOpinion = state.communityOpinion

  const mkEffect = (target: 'self' | 'opponent', ch: 'nameRecognition' | 'favorability', mag: number, tone: number) => ({
    channel: ch as never,
    target,
    magnitude: mag,
    rampDurationDays: 4,
    decayHalfLifeDays: ch === 'nameRecognition' ? 25 : 20,
    tone,
  })
  const specs: ReturnType<typeof mkEffect>[] = []
  let opinionShifts = state.opinionShifts
  let logMsg = ''

  if (payload.tone === 'positive') {
    specs.push(mkEffect('self', 'nameRecognition', channel.awareness * power, 0.6))
    specs.push(mkEffect('self', 'favorability', channel.favorability * power, 0.7))
    logMsg = `Ran positive ${channel.label} ads.`
  } else if (payload.tone === 'attack' && policy) {
    // Attacking a position the district AGREES with backfires (TPP's rule).
    const oppStance = (opp.positions[policy.areaId] ?? 0) + 0 // opponent's area stance stands in for the policy
    const agree = agreementShare(effectiveElectorate(state), policy.areaId, oppStance) + policy.popularOffset * Math.sign(oppStance)
    const threshold = ATTACK_BACKFIRE_THRESHOLD + staffEffectiveness(state.campaign, 'oppo_researcher') * 0.12
    const oppoAmp = 1 + staffEffectiveness(state.campaign, 'oppo_researcher') * 0.35
    if (agree >= threshold) {
      specs.push(mkEffect('opponent', 'favorability', 0.03 * budget, 0.4)) // rally-round effect
      specs.push(mkEffect('self', 'favorability', -0.025 * budget, -0.6))
      logMsg = `Attack ad on ${policy.label} BACKFIRED — the district agrees with them.`
    } else {
      specs.push(mkEffect('opponent', 'favorability', -0.05 * power * oppoAmp, -0.7))
      specs.push(mkEffect('self', 'favorability', -0.012 * budget, -0.7))
      specs.push(mkEffect('self', 'nameRecognition', channel.awareness * 0.3 * power, 0))
      logMsg = `Hit ${opp.name} on ${policy.label}.`
    }
  } else if (payload.tone === 'issue' && policy) {
    const dir = Math.sign(player.positions[policy.areaId] ?? 0) || 1
    const delta = channel.opinion * power * dir
    if (channel.id === 'mail') {
      // Per-community opinion (M2): a mailer moves THIS place, hard — twice the district cap.
      const here = state.territory.playerLocation
      const local = { ...(communityOpinion[here] ?? {}) }
      local[policy.areaId] = clamp((local[policy.areaId] ?? 0) + delta * 3, -OPINION_SHIFT_CAP * 2, OPINION_SHIFT_CAP * 2)
      communityOpinion = { ...communityOpinion, [here]: local }
    } else {
      const current = opinionShifts[policy.areaId] ?? 0
      opinionShifts = { ...opinionShifts, [policy.areaId]: clamp(current + delta, -OPINION_SHIFT_CAP, OPINION_SHIFT_CAP) }
    }
    specs.push(mkEffect('self', 'favorability', channel.favorability * 0.5 * power, 0.5))
    logMsg = `Issue campaign: ${policy.label} (${dir > 0 ? policy.proLabel : policy.conLabel}). Opinion moved${channel.id === 'mail' ? ' locally' : ''}.`
  }

  // Direct mail is LOCAL: it lands in the community you're standing in (and builds presence there).
  let territory = state.territory
  let extraMult = 1
  if (channel.id === 'mail') {
    extraMult = localReach(state.territory, state.territory.playerLocation)
    territory = {
      ...territory,
      presence: bumpPresence(territory.presence, territory, territory.playerLocation, 0.2),
    }
  }

  const effects = lowerEffects(
    { id: `ad:${channel.id}:${payload.tone}:${day}`, effects: specs as never },
    {
      candidateId: state.playerCandidateId,
      opponentId: opponentId(state),
      jurisdictionId: state.election.jurisdictionId,
      day,
      ledgerLength: state.ledger.length,
      multiplier: extraMult,
    },
  )
  return {
    ...state,
    campaign: {
      ...state.campaign,
      finance: spend(state.campaign.finance, cost),
      actionPoints: state.campaign.actionPoints - 1,
      adFatigue: {
        ...state.campaign.adFatigue,
        [channel.id]:
          fatigueN + (staffEffectiveness(state.campaign, 'comms_director') > 0 ? 0.7 : 1),
      },
    },
    territory,
    opinionShifts,
    communityOpinion,
    ledger: [...state.ledger, ...effects],
    meta: bumpRevision(state),
    log: [...state.log, { day, kind: 'action', message: `${logMsg} (${formatUsd(cost)})` }],
  }
}

const POLL_COSTS: Record<string, number> = { crosstabs: 8_000_00, issues: 10_000_00, communities: 6_000_00, opponent: 12_000_00 }

function commissionPoll(state: GameState, kind: string): GameState {
  if (state.phase !== 'campaign') return state
  const day = state.calendar.dayIndex
  const base = POLL_COSTS[kind]
  if (!base) return blocked(state, day, 'Unknown poll type.')
  const sizeScale = Math.sqrt(Math.max(0.25, state.electorate.cvap / 560_000))
  const cost = Math.round(base * sizeScale * (staffEffectiveness(state.campaign, 'pollster') > 0 ? 0.5 : 1))
  if (!canAfford(state.campaign.finance, cost)) return blocked(state, day, 'Not enough cash for field work.')

  const electorate = effectiveElectorate(state)
  const profiles = profilesAt(state, state.ledger, day)
  const player = state.candidates[state.playerCandidateId]!
  let report: GameState['pollReports'][number]
  let territory = state.territory

  if (kind === 'crosstabs') {
    const rows = electorate.groups.map((g) => {
      const sub: ElectorateState = { ...electorate, groups: [g], cvap: g.cvap }
      const share = evaluateElectorate(sub, profiles).sharesByCandidate[state.playerCandidateId] ?? 0
      const label = SEGMENT_DEFS.find((s) => s.id === g.id)?.label ?? g.id
      // Hidden priorities, revealed: this segment's top issues by effective salience.
      const top = [...ISSUE_DEFS]
        .sort((a, b) => (g.issueSalience[b.id] ?? 1) - (g.issueSalience[a.id] ?? 1))
        .slice(0, 2)
        .map((i) => i.name)
        .join(', ')
      return [label, `${(g.weight * 100).toFixed(0)}%`, `${(share * 100).toFixed(0)}%`, `${(g.turnoutPropensity * 100).toFixed(0)}%`, top] as const
    })
    report = { day, kind: 'crosstabs', title: 'Demographic crosstabs', cost, columns: ['Segment', 'Of electorate', 'With you', 'Turnout', 'Cares most about'], rows }
  } else if (kind === 'issues') {
    const rows = POLICIES.map((p) => {
      const stance = player.positions[p.areaId] ?? 0
      const support = agreementShare(electorate, p.areaId, stance || 1) + p.popularOffset * Math.sign(stance || 1)
      const area = ISSUE_DEFS.find((i) => i.id === p.areaId)?.name ?? p.areaId
      const yourSide = (stance || 1) > 0 ? p.proLabel : p.conLabel
      return [p.label, area, yourSide, `${Math.round(Math.max(0, Math.min(1, support)) * 100)}%`] as const
    }).sort((a, b) => parseInt(String(b[3])) - parseInt(String(a[3])))
    report = { day, kind: 'issues', title: 'Policy sentiment', cost, columns: ['Policy', 'Area', 'Your side', 'District agreement'], rows }
  } else if (kind === 'opponent') {
    // Opposition research: their platform, exposed policy by policy, plus a war-chest estimate.
    const opp = state.candidates[opponentId(state)]!
    const oppAi = state.aiCandidates[opp.id]
    const headRows: (readonly [string, string, string, string])[] = oppAi
      ? [[`War chest (est.)`, formatUsd(Math.round(oppAi.cash / 5_000_00) * 5_000_00), `${oppAi.personality.replace('_', ' ')} playbook`, ''] as const]
      : []
    const rows = POLICIES.map((p) => {
      const stance = opp.positions[p.areaId] ?? 0
      const side = stance > 0.05 ? p.proLabel : stance < -0.05 ? p.conLabel : 'No clear position'
      const agree = agreementShare(electorate, p.areaId, stance || 1) + p.popularOffset * Math.sign(stance || 1)
      const vuln = stance !== 0 && agree < 0.45 ? 'VULNERABLE' : ''
      return [p.label, side, `${Math.round(Math.max(0, Math.min(1, agree)) * 100)}% agree`, vuln] as const
    }).sort((a, b) => (a[3] === 'VULNERABLE' ? -1 : 1) - (b[3] === 'VULNERABLE' ? -1 : 1))
    report = { day, kind: 'issues', title: `Oppo book: ${opp.name}`, cost, columns: ['Policy', 'Their position', 'District', 'Attack?'], rows: [...headRows, ...rows] }
  } else {
    // Community poll: buys intel on the 5 biggest communities you haven't canvassed lately.
    const staleBefore = day - 21
    const targets = [...state.territory.communities]
      .filter((c) => !state.territory.intel[c.id] || state.territory.intel[c.id]!.day < staleBefore)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
    const intel = { ...state.territory.intel }
    const rows = targets.map((c) => {
      const share = measureCommunity(state, c.id, day)
      intel[c.id] = { day, playerShare: share }
      return [c.name, `${(c.weight * 100).toFixed(0)}%`, `${Math.round(share * 100)}%`] as const
    })
    territory = { ...state.territory, intel }
    report = { day, kind: 'communities', title: 'Community tracking poll', cost, columns: ['Community', 'Of voters', 'With you'], rows }
  }

  return {
    ...state,
    campaign: { ...state.campaign, finance: spend(state.campaign.finance, cost) },
    territory,
    pollReports: [...state.pollReports, report],
    meta: bumpRevision(state),
    log: [...state.log, { day, kind: 'action', message: `Commissioned ${report.title.toLowerCase()} (${formatUsd(cost)}).` }],
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
export function tick(state: GameState): GameState {
  if (state.phase !== 'campaign') return state
  const calendar = advanceCalendar(state.calendar, 1)
  const day = calendar.dayIndex
  const candidate = state.candidates[state.playerCandidateId]!

  // AI candidates take their turns FIRST (they read last week's race, like the player did).
  const preProfiles = profilesAt(state, state.ledger, state.calendar.dayIndex)
  const preShares = evaluateElectorate(effectiveElectorate(state), preProfiles).sharesByCandidate
  const decayRate = staffEffectiveness(state.campaign, 'field_director') > 0 ? 0.85 : 0.75
  const decayMap = (m: Readonly<Record<string, number>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * decayRate]).filter(([, v]) => (v as number) > 0.01))
  let oppPresence = decayMap(state.territory.oppPresence)
  const aiCandidates: GameState['aiCandidates'] = { ...state.aiCandidates }
  const aiEffects: ScheduledEffect[] = []
  const aiLogs: GameState['log'] = []
  let ledgerLen = state.ledger.length
  for (const id of Object.keys(aiCandidates)) {
    const res = runAiTurn(aiCandidates[id]!, {
      day,
      ledgerLength: ledgerLen,
      jurisdictionId: state.election.jurisdictionId,
      intensity: state.aiOpponentIntensity,
      territory: state.territory,
      profiles: preProfiles,
      shares: preShares,
      rngBase: state.rng.ai!,
    })
    aiCandidates[id] = res.ai
    aiEffects.push(...res.effects)
    ledgerLen += res.effects.length
    for (const [cid, amt] of Object.entries(res.presence)) {
      oppPresence[cid] = Math.min(1, (oppPresence[cid] ?? 0) + amt)
    }
    aiLogs.push({
      day,
      kind: 'opposition',
      message: `${state.candidates[id]?.name ?? 'A rival'} ${res.logLine}.`,
    })
  }
  const primaryOpp = state.election.candidateIds.find((id) => id !== state.playerCandidateId)
  const territoryAfterAi = {
    ...state.territory,
    presence: decayMap(state.territory.presence),
    oppPresence,
    opponentLocation: primaryOpp ? (aiCandidates[primaryOpp]?.location ?? state.territory.opponentLocation) : state.territory.opponentLocation,
  }

  // Player upkeep.
  const tickRes = tickCampaign(state.campaign, candidate, calendar.daysPerTick)
  // A digital director converts name recognition into a weekly online-donation stream.
  const digitalEff = staffEffectiveness(state.campaign, 'digital_director')
  const awarenessNow = profilesAt(state, state.ledger, state.calendar.dayIndex).find(
    (p) => p.candidateId === state.playerCandidateId,
  )!.awareness
  const onlineRaise = digitalEff > 0 ? Math.round(60000 * digitalEff * awarenessNow) : 0
  const campaignAfterUpkeep =
    onlineRaise > 0
      ? { ...tickRes.campaign, finance: raise(tickRes.campaign.finance, onlineRaise) }
      : tickRes.campaign
  let ledger = [...state.ledger, ...aiEffects]

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
      const eff = effectiveElectorate(state)
      result = resolveElection(eff, profiles, state.election.method, {
        turnoutBoost: boost,
        rng: tieRng,
        // M2: election night is the SUM of the map — ground presence is worth real votes.
        communities: state.territory.communities.map((c) => ({
          electorate: communityElectorate(eff, c, state.communityOpinion[c.id]),
          profiles: localProfiles(profiles, state.playerCandidateId, c, state.territory),
        })),
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
    territory: territoryAfterAi,
    campaign: campaignAfterUpkeep,
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
  const withAi: GameState = { ...advanced, aiCandidates, log: [...advanced.log, ...aiLogs] }
  // Dilemmas: auto-resolve last week's ignored one, then maybe land a new one on the desk.
  return tickDilemmas(withAi, day)
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
    case 'campaign/runAd':
      return runAd(state, action.payload)
    case 'campaign/commissionPoll':
      return commissionPoll(state, action.payload.kind)
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
