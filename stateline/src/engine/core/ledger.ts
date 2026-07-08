/**
 * The unified effects ledger.
 *
 * A central design decision (see docs/design): the campaign engine and the governing engine both
 * produce "a lagged, attributed change to the simulation". Rather than two parallel systems, both
 * lower their effects into ONE list of {@link ScheduledEffect}s. The electorate and economy are pure
 * CONSUMERS of this ledger — they read the active magnitude of effects targeting them and never get
 * written to directly. This keeps one source of truth and one ramp/decay/sunset implementation.
 */
import type { DayIndex } from './calendar'
import type { EntityId, Signed1 } from './primitives'

/** Which modeled quantity an effect pushes on. */
export type EffectChannel = 'nameRecognition' | 'favorability' | 'turnout' | 'persuasion'

export type EffectTarget =
  | {
      readonly kind: 'electorate'
      readonly jurisdictionId: EntityId
      readonly candidateId: EntityId
      readonly channel: EffectChannel
      /** Optional per-segment reach weights (segmentId -> weight). Absent = uniform across the electorate. */
      readonly segmentWeights?: Readonly<Record<string, number>>
      /** For `persuasion`, which issue the message moved on. */
      readonly issueId?: string
      /** Message tone, -1 (attack) .. +1 (positive). */
      readonly tone?: Signed1
    }
  | { readonly kind: 'simValue'; readonly valueId: string }
  | { readonly kind: 'groupHappiness'; readonly groupId: string }

export interface ScheduledEffect {
  readonly id: EntityId
  readonly target: EffectTarget
  readonly op: 'add' | 'mul' | 'set'
  /** Peak magnitude (in the target's units). */
  readonly magnitude: number
  readonly enactedDay: DayIndex
  /** Delay (days) after enactment before the effect begins ramping. */
  readonly rampStartDays: number
  /** Days to linearly ramp 0 -> magnitude. 0 = instantaneous. */
  readonly rampDurationDays: number
  /** Exponential decay half-life (days) after the plateau; null = permanent. */
  readonly decayHalfLifeDays: number | null
  /** Hard cut-off day after which the effect is gone; null = none. */
  readonly sunsetDay: DayIndex | null
  /** Who is credited/blamed (a candidate, legislator, executive). */
  readonly attributionActorId: EntityId | null
  readonly sourceSubsystem: 'campaign' | 'governing' | 'event'
}

/**
 * The effective magnitude of an effect on a given day, applying ramp -> plateau -> decay -> sunset.
 *
 * Example (magnitude 10, rampStart 0, rampDuration 4d, halfLife 10d):
 *   day 0 -> 0, day 2 -> 5, day 4 -> 10 (plateau reached), then decays: day 14 -> ~5.
 */
export function appliedMagnitudeAt(effect: ScheduledEffect, day: DayIndex): number {
  if (effect.sunsetDay !== null && day >= effect.sunsetDay) return 0
  const t = day - (effect.enactedDay + effect.rampStartDays)
  if (t < 0) return 0

  let magnitude: number
  if (effect.rampDurationDays <= 0) {
    magnitude = effect.magnitude
  } else {
    magnitude = effect.magnitude * Math.min(1, t / effect.rampDurationDays)
  }

  if (effect.decayHalfLifeDays !== null) {
    const afterPlateau = t - effect.rampDurationDays
    if (afterPlateau > 0) {
      magnitude = effect.magnitude * Math.pow(0.5, afterPlateau / effect.decayHalfLifeDays)
    }
  }
  return magnitude
}

/** True if an effect still contributes anything on/after `day` (used to prune the ledger). */
export function isEffectLive(effect: ScheduledEffect, day: DayIndex): boolean {
  if (effect.sunsetDay !== null && day >= effect.sunsetDay) return false
  if (effect.decayHalfLifeDays !== null) {
    // Treat as dead once decayed below ~0.4% of peak (8 half-lives).
    const afterPlateau = day - (effect.enactedDay + effect.rampStartDays) - effect.rampDurationDays
    if (afterPlateau > effect.decayHalfLifeDays * 8) return false
  }
  return true
}

export interface ChannelQuery {
  readonly jurisdictionId: EntityId
  readonly candidateId: EntityId
  readonly channel: EffectChannel
  /** If provided, only effects with no issue or this issue are summed. */
  readonly issueId?: string
}

/**
 * Sum the active 'add' magnitude of all electorate effects matching a channel query on a day.
 * (The slice only needs additive electorate channels; `mul`/`set` and other targets are summed by
 * their own consumers as those systems come online.)
 */
export function sumElectorateChannel(
  ledger: readonly ScheduledEffect[],
  day: DayIndex,
  query: ChannelQuery,
): number {
  let total = 0
  for (const e of ledger) {
    if (e.target.kind !== 'electorate') continue
    if (e.op !== 'add') continue
    const tgt = e.target
    if (tgt.jurisdictionId !== query.jurisdictionId) continue
    if (tgt.candidateId !== query.candidateId) continue
    if (tgt.channel !== query.channel) continue
    if (query.issueId !== undefined && tgt.issueId !== undefined && tgt.issueId !== query.issueId)
      continue
    total += appliedMagnitudeAt(e, day)
  }
  return total
}

export function pruneLedger(ledger: readonly ScheduledEffect[], day: DayIndex): ScheduledEffect[] {
  return ledger.filter((e) => isEffectLive(e, day))
}
