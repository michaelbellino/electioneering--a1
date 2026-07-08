/**
 * Scenario definition + `createGame`. A scenario is the moddable, serializable description of a starting
 * situation: which real jurisdiction, the calendar, the player and opponent candidates, and starting
 * resources. `createGame` deterministically expands it into a full {@link GameState}.
 */
import type { CalendarDate } from './core/calendar'
import { createCalendar, dateToDayIndex, formatDate } from './core/calendar'
import { createRng } from './core/rng'
import { createEventQueue, scheduleEvent } from './core/events'
import { clamp, clamp01, type Cents, type EntityId, type Signed1 } from './core/primitives'
import type { IssueId } from '../data/schema'
import { getDifficulty } from '../data/campaign/difficulties'
import { getTrait, MAX_TRAITS } from '../data/campaign/traits'
import { loadContent } from '../data/loader'
import { getJurisdiction } from '../data/loader'
import { buildElectorate } from './electorate/build'
import type { Party } from './electorate/types'
import { createCampaign, createCandidate } from './campaign/logic'
import { generateTerritory } from './territory/generate'
import type { CandidateAttributes } from './campaign/types'
import type { ElectoralMethod } from './electoral/types'
import { ENGINE_VERSION, EVENT_ELECTION_DAY, type GameState } from './state'

export interface ScenarioCandidate {
  readonly id: EntityId
  readonly name: string
  readonly party: Party
  readonly attributes?: Partial<CandidateAttributes>
  readonly positions?: Partial<Record<IssueId, Signed1>>
  readonly baseExposure?: number
  readonly baseFavorability?: Signed1
}

export interface Scenario {
  readonly id: string
  readonly title: string
  readonly jurisdictionId: EntityId
  readonly startDate: CalendarDate
  readonly electionDate: CalendarDate
  readonly method: ElectoralMethod
  readonly player: ScenarioCandidate
  readonly opponent: ScenarioCandidate
  readonly startingCash: Cents
  /** How hard the AI opponent campaigns each tick (name-rec exposure units emitted per week). */
  readonly opponentIntensity: number
}

/** Sandbox overrides — every knob optional; set ones win over scenario + difficulty. */
export interface SandboxOverrides {
  readonly startingCash?: Cents
  /** 0..1: how hard the AI opponent campaigns. */
  readonly opponentIntensity?: number
  readonly maxActionPoints?: number
  /** Override race length; election day becomes startDate + weeks×7. */
  readonly weeks?: number
}

/** Run configuration beyond the scenario itself: difficulty, traits, sandbox knobs. */
export interface GameSetup {
  readonly difficultyId?: string
  readonly traitIds?: readonly string[]
  readonly sandbox?: SandboxOverrides
}

const isDefined = <T>(x: T | undefined): x is T => x !== undefined

export function createGame(scenario: Scenario, seed: number, setup: GameSetup = {}): GameState {
  const { voterModel, demographics } = loadContent()
  const jurisdiction = getJurisdiction(demographics, scenario.jurisdictionId)
  const electorate = buildElectorate(jurisdiction, voterModel)

  const territory = generateTerritory(
    electorate,
    createRng(seed ^ 0x7ae3c9d1),
    jurisdiction.level === 'state' ? 19 : 13,
  )

  const difficulty = getDifficulty(setup.difficultyId ?? 'normal')
  const traits = (setup.traitIds ?? []).slice(0, MAX_TRAITS).map(getTrait).filter(isDefined)

  // Traits modify the player's raw candidate inputs before creation.
  const traitAttr = (k: keyof CandidateAttributes): number =>
    traits.reduce((a, t) => a + (t.attributes?.[k] ?? 0), 0)
  const basePlayer = scenario.player
  const player = createCandidate({
    ...basePlayer,
    attributes: {
      charisma: clamp01((basePlayer.attributes?.charisma ?? 0.5) + traitAttr('charisma')),
      competence: clamp01((basePlayer.attributes?.competence ?? 0.5) + traitAttr('competence')),
      integrity: clamp01((basePlayer.attributes?.integrity ?? 0.5) + traitAttr('integrity')),
      fundraising: clamp01((basePlayer.attributes?.fundraising ?? 0.5) + traitAttr('fundraising')),
    },
    baseExposure:
      (basePlayer.baseExposure ?? 0.15) + traits.reduce((a, t) => a + (t.baseExposure ?? 0), 0),
    baseFavorability: clamp(
      (basePlayer.baseFavorability ?? 0) + traits.reduce((a, t) => a + (t.baseFavorability ?? 0), 0),
      -1,
      1,
    ),
  })
  const opponent = createCandidate({ ...scenario.opponent })

  const startDay = dateToDayIndex(scenario.startDate)
  const electionDay =
    setup.sandbox?.weeks !== undefined
      ? startDay + Math.max(4, Math.round(setup.sandbox.weeks)) * 7
      : dateToDayIndex(scenario.electionDate)
  const electionId = `election:${scenario.id}`

  const startingCash =
    setup.sandbox?.startingCash ??
    Math.round(scenario.startingCash * difficulty.cashMult) +
      traits.reduce((a, t) => a + (t.cashDelta ?? 0), 0)
  const maxActionPoints = Math.max(
    1,
    (setup.sandbox?.maxActionPoints ?? difficulty.maxActionPoints) +
      traits.reduce((a, t) => a + (t.apDelta ?? 0), 0),
  )

  const campaign = createCampaign({
    id: `campaign:${scenario.id}`,
    candidateId: player.id,
    electionId,
    jurisdictionId: scenario.jurisdictionId,
    opponentIds: [opponent.id],
    startingCash,
    maxActionPoints,
    modifiers: {
      salaryMult: traits.reduce((a, t) => a * (t.salaryMult ?? 1), 1),
      scandalMult: traits.reduce((a, t) => a * (t.scandalMult ?? 1), 1),
    },
  })

  let eventQueue = createEventQueue()
  eventQueue = scheduleEvent(eventQueue, {
    day: electionDay,
    kind: EVENT_ELECTION_DAY,
    payload: { electionId },
    id: `evt:election:${electionId}`,
  })

  return {
    meta: {
      seed,
      dataVersion: demographics.dataVersion,
      engineVersion: ENGINE_VERSION,
      revision: 0,
      scenarioId: scenario.id,
      difficulty: difficulty.id,
      traitIds: traits.map((t) => t.id),
    },
    phase: 'campaign',
    calendar: createCalendar(scenario.startDate, 7),
    rng: {
      polling: createRng(seed ^ 0x9e3779b9),
      events: createRng(seed ^ 0x51ed270b),
      ai: createRng(seed ^ 0x1b56c4e9),
    },
    eventQueue,
    ledger: [],
    election: {
      id: electionId,
      jurisdictionId: scenario.jurisdictionId,
      title: scenario.title,
      electionDay,
      method: scenario.method,
      candidateIds: [player.id, opponent.id],
    },
    electorate,
    territory,
    candidates: { [player.id]: player, [opponent.id]: opponent },
    playerCandidateId: player.id,
    aiOpponentIntensity:
      setup.sandbox?.opponentIntensity ?? scenario.opponentIntensity * difficulty.opponentMult,
    campaign,
    result: null,
    polls: [],
    pendingDilemma: null,
    seenDilemmas: [],
    opinionShifts: {},
    pollReports: [],
    log: [
      {
        day: dateToDayIndex(scenario.startDate),
        kind: 'game_start',
        message: `Campaign begins for ${scenario.title}. Election day: ${formatDate(electionDay)}.`,
      },
    ],
  }
}
