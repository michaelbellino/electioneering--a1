/**
 * Campaign engine types — the SIMULATED game layer a player uses to run for office. None of this is
 * real data: candidates, money, ads, rallies, staff and offices are game mechanics. The campaign's only
 * coupling to the electorate is that its actions emit {@link ScheduledEffect}s into the core ledger,
 * which the electorate then consumes (name recognition, favorability, turnout). That keeps the campaign
 * decoupled and the whole thing deterministic.
 */
import type { Cents, EntityId, Signed1, Unit01 } from '../core/primitives'
import type { DayIndex } from '../core/calendar'
import type { EffectChannel } from '../core/ledger'
import type { IssueId } from '../../data/schema'
import type { Party } from '../electorate/types'

/** Candidate attributes that map to valence and fundraising ability. */
export interface CandidateAttributes {
  readonly charisma: Unit01
  readonly competence: Unit01
  readonly integrity: Unit01
  /** Innate fundraising ability multiplier 0..1 (rolodex, donor network). */
  readonly fundraising: Unit01
}

export interface CandidateState {
  readonly id: EntityId
  readonly name: string
  readonly party: Party
  readonly attributes: CandidateAttributes
  /** The candidate's issue platform, −1..+1 per issue. */
  readonly positions: Readonly<Record<IssueId, Signed1>>
  /** Pre-campaign name recognition (incumbents/celebrities start higher), exposure units ≥ 0. */
  readonly baseExposure: number
  /** Pre-campaign net favorability. */
  readonly baseFavorability: Signed1
  /** Unresolved scandal load, 0..1 (drags valence/favorability). */
  readonly scandalLoad: Unit01
}

export type StaffRole =
  | 'manager'
  | 'fundraiser'
  | 'field_director'
  | 'comms_director'
  | 'pollster'
  | 'oppo_researcher'
  | 'digital_director'

export interface StaffMember {
  readonly id: EntityId
  readonly role: StaffRole
  /** Weekly salary in cents. */
  readonly weeklySalary: Cents
  /** Effectiveness multiplier 0..1 applied to actions in this staffer's domain. */
  readonly effectiveness: Unit01
}

export interface CampaignStrategy {
  /** Overall messaging tone, −1 (negative/attack) .. +1 (positive). */
  readonly tone: Signed1
  /** Optional issue to emphasize; boosts persuasion effects on it. */
  readonly focusIssue: IssueId | null
}

/** Run-level multipliers granted by traits (and future perks). */
export interface CampaignModifiers {
  /** Multiplier on weekly staff salaries. */
  readonly salaryMult: number
  /** Multiplier on incoming scandal damage to the player. */
  readonly scandalMult: number
}

export interface FinanceState {
  readonly cash: Cents
  readonly totalRaised: Cents
  readonly totalSpent: Cents
}

export interface CampaignState {
  readonly id: EntityId
  readonly candidateId: EntityId
  readonly electionId: EntityId
  readonly jurisdictionId: EntityId
  readonly opponentIds: readonly EntityId[]
  readonly finance: FinanceState
  /** Action points available this week (spent by actions, regen on tick). */
  readonly actionPoints: number
  readonly maxActionPoints: number
  readonly staff: readonly StaffMember[]
  /** Number of regional field offices opened (tycoon layer; boosts field actions). */
  readonly offices: number
  readonly strategy: CampaignStrategy
  /** defId -> the day the action becomes available again. */
  readonly cooldowns: Readonly<Record<string, DayIndex>>
  readonly modifiers: CampaignModifiers
  /** Ad buys per channel this campaign (drives diminishing returns). */
  readonly adFatigue: Readonly<Record<string, number>>
}

/** A single ledger effect an action emits, before being lowered to a ScheduledEffect. */
export interface EffectSpec {
  readonly channel: EffectChannel
  /** Whose number this moves. */
  readonly target: 'self' | 'opponent'
  readonly magnitude: number
  readonly rampDurationDays: number
  readonly decayHalfLifeDays: number | null
  /** For persuasion, which issue; for ads, the tone. */
  readonly issueId?: IssueId
  readonly tone?: Signed1
}

export type CampaignActionCategory =
  | 'advertising'
  | 'event'
  | 'message'
  | 'ground_game'
  | 'fundraising'
  | 'operations'

/** Data-driven definition of a campaign action. Adding actions = adding data. */
export interface CampaignActionDef {
  readonly id: string
  readonly label: string
  readonly category: CampaignActionCategory
  readonly description: string
  readonly cashCost: Cents
  readonly actionPointCost: number
  readonly cooldownDays: number
  /** Effects emitted into the ledger when performed. */
  readonly effects: readonly EffectSpec[]
  /** If set, this action RAISES money instead of (or in addition to) spending it. */
  readonly fundraising?: {
    /** Base gross raised in cents before candidate/staff multipliers. */
    readonly baseAmount: Cents
  }
  /** Which staff role amplifies this action (effectiveness scales magnitudes / yield). */
  readonly amplifiedBy?: StaffRole
}
