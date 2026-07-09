/**
 * Candidate background traits — the roguelike layer of candidate creation. Pick up to two. Every
 * trait is a TRADEOFF bundle (never strictly better), so builds are choices, not checklists. Pure
 * data: the engine applies these generically at game creation.
 */
import type { Cents } from '../../engine/core/primitives'
import type { CandidateAttributes } from '../../engine/campaign/types'

export interface TraitDef {
  readonly id: string
  readonly label: string
  readonly description: string
  /** Additive attribute deltas (applied after point-buy, clamped to 0..1). */
  readonly attributes?: Partial<Record<keyof CandidateAttributes, number>>
  /** Additive pre-campaign exposure (name recognition head start). */
  readonly baseExposure?: number
  /** Additive pre-campaign net favorability. */
  readonly baseFavorability?: number
  /** Starting-cash delta in cents (after difficulty multiplier). */
  readonly cashDelta?: Cents
  /** Extra (or fewer) action points per week. */
  readonly apDelta?: number
  /** Multiplier on weekly staff salaries (Party Insider gets discounts…). */
  readonly salaryMult?: number
  /** Multiplier on incoming scandal damage (Teflon shrugs it off). */
  readonly scandalMult?: number
}

const USD = (d: number): Cents => Math.round(d * 100)

export const TRAITS: readonly TraitDef[] = [
  {
    id: 'hometown_hero',
    label: 'Hometown Hero',
    description: 'Everyone already knows your name — and your baggage.',
    baseExposure: 0.25,
    baseFavorability: -0.05,
  },
  {
    id: 'self_funder',
    label: 'Self-Funder',
    description: 'You write your own checks. Donors find that… demotivating.',
    cashDelta: USD(40_000),
    attributes: { fundraising: -0.15 },
  },
  {
    id: 'grassroots_army',
    label: 'Grassroots Army',
    description: 'A volunteer machine gives you an extra action every week, but it runs on pizza money.',
    apDelta: 1,
    cashDelta: USD(-15_000),
  },
  {
    id: 'teflon',
    label: 'Teflon',
    description: 'Scandals slide right off. Charisma was the price.',
    scandalMult: 0.4,
    attributes: { charisma: -0.1 },
  },
  {
    id: 'party_insider',
    label: 'Party Insider',
    description: 'The machine staffs your campaign at mates’ rates. You owe people.',
    salaryMult: 0.65,
    attributes: { integrity: -0.1 },
  },
  {
    id: 'outsider',
    label: 'Outsider',
    description: 'Voters like that you’re not one of them. Professionals charge you extra.',
    baseFavorability: 0.08,
    salaryMult: 1.35,
  },
  {
    id: 'policy_wonk',
    label: 'Policy Wonk',
    description: 'You can cite the appendix. Crowds cite the exits.',
    attributes: { competence: 0.15, charisma: -0.1 },
  },
  {
    id: 'firebrand',
    label: 'Firebrand',
    description: 'You light up a room — sometimes with the room still in it.',
    attributes: { charisma: 0.15, integrity: -0.1 },
  },
] as const

export function getTrait(id: string): TraitDef | undefined {
  return TRAITS.find((t) => t.id === id)
}

export const MAX_TRAITS = 2
