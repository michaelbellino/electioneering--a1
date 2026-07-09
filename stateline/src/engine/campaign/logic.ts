/**
 * Campaign factories + the action/tick logic. Pure functions returning new state (no mutation), so the
 * root reducer can call them and the whole thing stays deterministic and serializable.
 */
import type { DayIndex } from '../core/calendar'
import type { Cents, EntityId, Signed1 } from '../core/primitives'
import type { ScheduledEffect } from '../core/ledger'
import type { IssueId } from '../../data/schema'
import { ISSUE_IDS } from '../../data/schema'
import type { Party } from '../electorate/types'
import { canAfford, createFinance, raise, spend } from './finance'
import { lowerEffects } from './pipeline'
import type {
  CampaignActionDef,
  CampaignState,
  CandidateAttributes,
  CandidateState,
  StaffMember,
  StaffRole,
} from './types'

let _seq = 0 // module-local id counter for convenience constructors (NOT part of game state)

export interface CreateCandidateInput {
  readonly id?: EntityId
  readonly name: string
  readonly party: Party
  readonly attributes?: Partial<CandidateAttributes>
  readonly positions?: Partial<Record<IssueId, Signed1>>
  readonly baseExposure?: number
  readonly baseFavorability?: Signed1
}

export function createCandidate(input: CreateCandidateInput): CandidateState {
  const positions = Object.fromEntries(
    ISSUE_IDS.map((id) => [id, input.positions?.[id] ?? 0]),
  ) as Record<IssueId, Signed1>
  return {
    id: input.id ?? `cand:${_seq++}`,
    name: input.name,
    party: input.party,
    attributes: {
      charisma: input.attributes?.charisma ?? 0.5,
      competence: input.attributes?.competence ?? 0.5,
      integrity: input.attributes?.integrity ?? 0.5,
      fundraising: input.attributes?.fundraising ?? 0.5,
    },
    positions,
    baseExposure: input.baseExposure ?? 0.15,
    baseFavorability: input.baseFavorability ?? 0,
    scandalLoad: 0,
  }
}

export interface CreateCampaignInput {
  readonly id?: EntityId
  readonly candidateId: EntityId
  readonly electionId: EntityId
  readonly jurisdictionId: EntityId
  readonly opponentIds?: readonly EntityId[]
  readonly startingCash?: Cents
  readonly maxActionPoints?: number
  readonly staff?: readonly StaffMember[]
  readonly offices?: number
}

export function createCampaign(input: CreateCampaignInput): CampaignState {
  const maxAP = input.maxActionPoints ?? 3
  return {
    id: input.id ?? `camp:${_seq++}`,
    candidateId: input.candidateId,
    electionId: input.electionId,
    jurisdictionId: input.jurisdictionId,
    opponentIds: input.opponentIds ?? [],
    finance: createFinance(input.startingCash ?? 0),
    actionPoints: maxAP,
    maxActionPoints: maxAP,
    staff: input.staff ?? [],
    offices: input.offices ?? 0,
    strategy: { tone: 0, focusIssue: null },
    cooldowns: {},
  }
}

function staffEffectiveness(campaign: CampaignState, role: StaffRole): number {
  return Math.min(
    1.5,
    campaign.staff.filter((s) => s.role === role).reduce((a, s) => a + s.effectiveness, 0),
  )
}

/** Amplification applied to an action's effect magnitudes. */
export function actionMultiplier(
  campaign: CampaignState,
  candidate: CandidateState,
  def: CampaignActionDef,
): number {
  let m = 1
  if (def.amplifiedBy) m += staffEffectiveness(campaign, def.amplifiedBy) * 0.5
  m += campaign.offices * 0.05
  if (def.category === 'event') m += candidate.attributes.charisma * 0.3
  return m
}

export function fundraiseMultiplier(campaign: CampaignState, candidate: CandidateState): number {
  return 1 + candidate.attributes.fundraising * 0.8 + staffEffectiveness(campaign, 'fundraiser') * 0.6
}

export interface ActionError {
  readonly code: 'no_ap' | 'insufficient_funds' | 'on_cooldown'
  readonly message: string
}

export interface ApplyActionResult {
  readonly ok: boolean
  readonly errors: readonly ActionError[]
  readonly campaign: CampaignState
  readonly newEffects: readonly ScheduledEffect[]
  readonly raised: Cents
}

export interface ApplyActionCtx {
  readonly day: DayIndex
  /** Current ledger length, used as a nonce for deterministic effect ids. */
  readonly ledgerLength: number
}

/**
 * Validate and apply a campaign action. On failure returns ok:false with errors and the UNCHANGED
 * campaign (no partial mutation). On success: spends cash, optionally raises, spends action points,
 * sets the cooldown, and returns the new ledger effects to append.
 */
export function applyCampaignAction(
  campaign: CampaignState,
  candidate: CandidateState,
  def: CampaignActionDef,
  ctx: ApplyActionCtx,
): ApplyActionResult {
  const errors: ActionError[] = []
  if (campaign.actionPoints < def.actionPointCost) {
    errors.push({ code: 'no_ap', message: 'Not enough action points this week.' })
  }
  if (!canAfford(campaign.finance, def.cashCost)) {
    errors.push({ code: 'insufficient_funds', message: 'Not enough cash on hand.' })
  }
  const availableOn = campaign.cooldowns[def.id]
  if (availableOn !== undefined && ctx.day < availableOn) {
    errors.push({ code: 'on_cooldown', message: 'This action is on cooldown.' })
  }
  if (errors.length > 0) {
    return { ok: false, errors, campaign, newEffects: [], raised: 0 }
  }

  let finance = spend(campaign.finance, def.cashCost)
  let raised = 0
  if (def.fundraising) {
    raised = Math.round(def.fundraising.baseAmount * fundraiseMultiplier(campaign, candidate))
    finance = raise(finance, raised)
  }

  const multiplier = actionMultiplier(campaign, candidate, def)
  const newEffects = lowerEffects(def, {
    candidateId: candidate.id,
    opponentId: campaign.opponentIds[0] ?? null,
    jurisdictionId: campaign.jurisdictionId,
    day: ctx.day,
    ledgerLength: ctx.ledgerLength,
    multiplier,
  })

  const next: CampaignState = {
    ...campaign,
    finance,
    actionPoints: campaign.actionPoints - def.actionPointCost,
    cooldowns: { ...campaign.cooldowns, [def.id]: ctx.day + def.cooldownDays },
  }
  return { ok: true, errors: [], campaign: next, newEffects, raised }
}

export interface TickResult {
  readonly campaign: CampaignState
  readonly raised: Cents
  readonly salariesPaid: Cents
}

/** Weekly-style upkeep: regenerate action points, pay staff, and book small-dollar income. */
export function tickCampaign(
  campaign: CampaignState,
  candidate: CandidateState,
  daysPerTick: number,
): TickResult {
  const weeks = daysPerTick / 7
  let finance = campaign.finance
  const salaries = Math.round(campaign.staff.reduce((a, s) => a + s.weeklySalary, 0) * weeks)
  if (salaries > 0) finance = spend(finance, salaries)
  const trickle = Math.round((20000 + 80000 * candidate.attributes.fundraising) * weeks)
  if (trickle > 0) finance = raise(finance, trickle)

  return {
    campaign: { ...campaign, finance, actionPoints: campaign.maxActionPoints },
    raised: trickle,
    salariesPaid: salaries,
  }
}
