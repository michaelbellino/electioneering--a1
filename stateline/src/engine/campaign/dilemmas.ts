/**
 * Weekly dilemmas — Democracy-style choice events, the roguelike heartbeat of a run.
 *
 * Each week there's a seeded chance a dilemma lands on your desk. It blocks nothing, but it won't
 * wait: if you advance the week without deciding, the DEFAULT option resolves for you (the story
 * moves on whether you engage or not). Options carry deterministic consequences plus an optional
 * RISK — a seeded gamble whose odds can be shaved by a candidate attribute, so a Firebrand can work
 * a heckler that would sink a Policy Wonk. All draws and rolls come from forked RNG streams; a given
 * seed always tells the same story.
 */
import type { Cents, EntityId, Signed1 } from '../core/primitives'
import type { IssueId } from '../../data/schema'
import type { CandidateAttributes, EffectSpec } from './types'

export interface DilemmaRisk {
  /** Base chance the bad outcome fires, 0..1. */
  readonly chance: number
  /** Attribute that mitigates: effective chance = chance × (1 − attr value). */
  readonly mitigatedBy?: keyof CandidateAttributes
  /** What happens on a bad roll. */
  readonly onFail: DilemmaConsequence
  /** Log line on a bad roll. */
  readonly failText: string
}

export interface DilemmaConsequence {
  /** Cash delta in cents (positive = you gain). */
  readonly cashDelta?: Cents
  /** Scandal load delta on a candidate, 0..1 scale. */
  readonly scandal?: { readonly target: 'self' | 'opponent'; readonly amount: number }
  /** Ledger effects, lowered exactly like a campaign action's. */
  readonly effects?: readonly EffectSpec[]
  /** Shift the player's platform (the price of an endorsement…). */
  readonly positionShifts?: readonly { readonly issueId: IssueId; readonly delta: Signed1 }[]
  /** Action points gained/lost immediately (this week only). */
  readonly apDelta?: number
}

export interface DilemmaOption {
  readonly id: string
  readonly label: string
  /** What taking this option means, shown to the player. */
  readonly blurb: string
  readonly consequence: DilemmaConsequence
  readonly risk?: DilemmaRisk
  /** Log line when chosen (and no risk fired). */
  readonly resultText: string
}

export interface DilemmaDef {
  readonly id: string
  readonly title: string
  /** The situation, second person, 1-3 sentences. */
  readonly prompt: string
  /** Draw weight (relative). */
  readonly weight: number
  /** Earliest / latest week (1-based from campaign start) this can appear. */
  readonly minWeek?: number
  readonly maxWeek?: number
  readonly options: readonly DilemmaOption[]
  /** Option auto-picked if the player advances the week without deciding. */
  readonly defaultOptionId: string
}

/** What sits in GameState while a dilemma awaits a decision. */
export interface PendingDilemma {
  readonly defId: string
  readonly day: number
}

export interface DilemmaLogEntryMeta {
  readonly defId: string
  readonly optionId: string
  readonly autoResolved: boolean
}

/** Pick a dilemma from the eligible pool by weight, using a caller-supplied uniform [0,1) roll. */
export function pickDilemma(
  defs: readonly DilemmaDef[],
  seen: readonly string[],
  week: number,
  roll: number,
): DilemmaDef | null {
  const eligible = defs.filter(
    (d) => !seen.includes(d.id) && week >= (d.minWeek ?? 1) && week <= (d.maxWeek ?? Infinity),
  )
  if (eligible.length === 0) return null
  const total = eligible.reduce((a, d) => a + d.weight, 0)
  let x = roll * total
  for (const d of eligible) {
    x -= d.weight
    if (x < 0) return d
  }
  return eligible[eligible.length - 1]!
}

export function getDilemmaOption(def: DilemmaDef, optionId: string): DilemmaOption {
  return def.options.find((o) => o.id === optionId) ?? def.options[0]!
}

export type { EntityId }
