/**
 * The root game state shape + engine constants. One plain serializable object: no class instances, no
 * Map/Set. Save/load is a JSON round-trip. Every field is here so the UI can render the whole game from
 * a single snapshot.
 */
import type { DayIndex, Calendar } from './core/calendar'
import type { RngState } from './core/rng'
import type { EventQueueState } from './core/events'
import type { ScheduledEffect } from './core/ledger'
import type { EntityId, GamePhase, LogEntry } from './core/primitives'
import type { ElectorateState } from './electorate/types'
import type { CampaignState, CandidateState } from './campaign/types'
import type { AllocationResult, ElectoralMethod } from './electoral/types'

export const ENGINE_VERSION = '0.1.0'

/** Event kind fired on election day. */
export const EVENT_ELECTION_DAY = 'election_day'

export interface GameMeta {
  readonly seed: number
  readonly dataVersion: string
  readonly engineVersion: string
  /** Bumped exactly once per applyAction/tick so UI selectors can memoize on it. */
  readonly revision: number
  readonly scenarioId: string
}

export interface SliceElection {
  readonly id: EntityId
  readonly jurisdictionId: EntityId
  readonly title: string
  readonly electionDay: DayIndex
  readonly method: ElectoralMethod
  readonly candidateIds: readonly EntityId[]
}

export interface PollRecord {
  readonly day: DayIndex
  readonly shares: Readonly<Record<EntityId, number>>
  readonly marginOfError: number
}

export interface GameState {
  meta: GameMeta
  phase: GamePhase
  calendar: Calendar
  rng: Record<string, RngState>
  eventQueue: EventQueueState
  ledger: ScheduledEffect[]
  election: SliceElection
  electorate: ElectorateState
  candidates: Record<EntityId, CandidateState>
  playerCandidateId: EntityId
  aiOpponentIntensity: number
  campaign: CampaignState
  result: AllocationResult | null
  polls: PollRecord[]
  log: LogEntry[]
}
