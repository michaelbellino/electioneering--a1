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
import type { PendingDilemma } from './campaign/dilemmas'
import type { TerritoryState } from './territory/generate'
import type { AiCandidateState } from './ai/agent'
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
  /** Difficulty level id this run was created with (see data/campaign/difficulties). */
  readonly difficulty: string
  /** Background traits picked at creation (see data/campaign/traits). */
  readonly traitIds: readonly string[]
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

/** A commissioned research product (crosstabs, issue sentiment, community canvass). */
export interface PollReport {
  readonly day: DayIndex
  readonly kind: 'crosstabs' | 'issues' | 'communities'
  readonly title: string
  readonly cost: number
  /** Generic tabular payload the UI renders as-is. */
  readonly columns: readonly string[]
  readonly rows: readonly (readonly (string | number)[])[]
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
  /** The semi-open-world map: communities, locations, presence, fog-of-war intel. */
  territory: TerritoryState
  candidates: Record<EntityId, CandidateState>
  /** Live AI state for every non-player candidate: war chest, personality, map location. */
  aiCandidates: Record<EntityId, AiCandidateState>
  playerCandidateId: EntityId
  aiOpponentIntensity: number
  campaign: CampaignState
  result: AllocationResult | null
  polls: PollRecord[]
  log: LogEntry[]
  /** Dilemma awaiting a decision (auto-resolves to its default if the week advances). */
  pendingDilemma: PendingDilemma | null
  /** Dilemma defs already drawn this run (each fires at most once). */
  seenDilemmas: string[]
  /** Capped per-issue public-opinion shifts won by issue advertising (applied to the electorate). */
  opinionShifts: Record<string, number>
  /** Commissioned research reports, newest last. */
  pollReports: PollReport[]
}
