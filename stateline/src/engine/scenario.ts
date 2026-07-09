/**
 * Scenario definition + `createGame`. A scenario is the moddable, serializable description of a starting
 * situation: which real jurisdiction, the calendar, the player and opponent candidates, and starting
 * resources. `createGame` deterministically expands it into a full {@link GameState}.
 */
import type { CalendarDate } from './core/calendar'
import { createCalendar, dateToDayIndex, formatDate } from './core/calendar'
import { createRng } from './core/rng'
import { createEventQueue, scheduleEvent } from './core/events'
import type { Cents, EntityId, Signed1 } from './core/primitives'
import type { IssueId } from '../data/schema'
import { loadContent } from '../data/loader'
import { getJurisdiction } from '../data/loader'
import { buildElectorate } from './electorate/build'
import type { Party } from './electorate/types'
import { createCampaign, createCandidate } from './campaign/logic'
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

export function createGame(scenario: Scenario, seed: number): GameState {
  const { voterModel, demographics } = loadContent()
  const jurisdiction = getJurisdiction(demographics, scenario.jurisdictionId)
  const electorate = buildElectorate(jurisdiction, voterModel)

  const player = createCandidate({ ...scenario.player })
  const opponent = createCandidate({ ...scenario.opponent })

  const electionDay = dateToDayIndex(scenario.electionDate)
  const electionId = `election:${scenario.id}`

  const campaign = createCampaign({
    id: `campaign:${scenario.id}`,
    candidateId: player.id,
    electionId,
    jurisdictionId: scenario.jurisdictionId,
    opponentIds: [opponent.id],
    startingCash: scenario.startingCash,
    maxActionPoints: 3,
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
    candidates: { [player.id]: player, [opponent.id]: opponent },
    playerCandidateId: player.id,
    aiOpponentIntensity: scenario.opponentIntensity,
    campaign,
    result: null,
    polls: [],
    log: [
      {
        day: dateToDayIndex(scenario.startDate),
        kind: 'game_start',
        message: `Campaign begins for ${scenario.title}. Election day: ${formatDate(electionDay)}.`,
      },
    ],
  }
}
