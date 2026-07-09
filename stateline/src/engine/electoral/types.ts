/**
 * Electoral structure: offices, seats, candidacies, election instances, and the result of running one.
 *
 * Data-driven and serializable so the full US office taxonomy (and modded ones) can be added as DATA.
 * The slice implements first-past-the-post; the {@link ElectoralMethod} union is the extension point for
 * two-round, ranked-choice, multi-member, and the Electoral College.
 */
import type { DayIndex } from '../core/calendar'
import type { EntityId, Unit01 } from '../core/primitives'
import type { Party } from '../electorate/types'

export type ElectoralMethod = 'fptp' | 'two_round' | 'ranked_choice' | 'electoral_college'

export type GovLevel = 'federal' | 'state' | 'county' | 'municipal' | 'special'

export interface OfficeDefinition {
  readonly id: EntityId
  readonly title: string
  readonly level: GovLevel
  readonly jurisdictionId: EntityId
  readonly method: ElectoralMethod
  /** Seats contested (1 for single-member). */
  readonly seats: number
  readonly partisan: boolean
  readonly termYears: number
}

export interface Seat {
  readonly id: EntityId
  readonly officeId: EntityId
  readonly jurisdictionId: EntityId
  readonly label: string
}

export interface Candidacy {
  readonly id: EntityId
  readonly candidateId: EntityId
  readonly seatId: EntityId
  readonly party: Party
  /** 'general' or a party primary. */
  readonly phase: 'primary' | 'general'
}

export type ElectionStatus = 'scheduled' | 'resolved' | 'runoff_required'

export interface ElectionInstance {
  readonly id: EntityId
  readonly seatId: EntityId
  readonly jurisdictionId: EntityId
  readonly method: ElectoralMethod
  readonly electionDay: DayIndex
  readonly phase: 'primary' | 'general'
  readonly candidacyIds: readonly EntityId[]
  readonly status: ElectionStatus
  readonly result: AllocationResult | null
}

export interface AllocationResult {
  readonly winnerIds: readonly EntityId[]
  readonly votesByCandidate: Readonly<Record<EntityId, number>>
  readonly sharesByCandidate: Readonly<Record<EntityId, number>>
  readonly turnout: Unit01
  /** Winner share minus runner-up share. */
  readonly margin: number
  readonly status: 'resolved' | 'runoff_required' | 'tie_unresolved'
}
