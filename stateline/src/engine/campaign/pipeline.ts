/**
 * Lower a campaign action's data-defined {@link EffectSpec}s into core {@link ScheduledEffect}s on the
 * electorate. This is the campaign→electorate bridge: after this, the campaign is out of the picture and
 * the electorate simply consumes ledger effects. Effect ids are deterministic (derived from the day and
 * the ledger length as a nonce) so replays produce identical ledgers.
 */
import type { DayIndex } from '../core/calendar'
import type { EntityId } from '../core/primitives'
import type { ScheduledEffect } from '../core/ledger'
import type { CampaignActionDef } from './types'

export interface LowerCtx {
  readonly candidateId: EntityId
  readonly opponentId: EntityId | null
  readonly jurisdictionId: EntityId
  readonly day: DayIndex
  /** Used only to make effect ids unique within a deterministic replay. */
  readonly ledgerLength: number
  /** Staff/office/candidate amplification applied to effect magnitudes. */
  readonly multiplier: number
}

export function lowerEffects(
  def: Pick<CampaignActionDef, 'id' | 'effects'>,
  ctx: LowerCtx,
): ScheduledEffect[] {
  const out: ScheduledEffect[] = []
  def.effects.forEach((spec, i) => {
    const targetCandidate = spec.target === 'opponent' ? ctx.opponentId : ctx.candidateId
    if (!targetCandidate) return
    out.push({
      id: `eff:${ctx.candidateId}:${def.id}:${ctx.day}:${ctx.ledgerLength}:${i}`,
      target: {
        kind: 'electorate',
        jurisdictionId: ctx.jurisdictionId,
        candidateId: targetCandidate,
        channel: spec.channel,
        ...(spec.issueId ? { issueId: spec.issueId } : {}),
        ...(spec.tone !== undefined ? { tone: spec.tone } : {}),
      },
      op: 'add',
      magnitude: spec.magnitude * ctx.multiplier,
      enactedDay: ctx.day,
      rampStartDays: 0,
      rampDurationDays: spec.rampDurationDays,
      decayHalfLifeDays: spec.decayHalfLifeDays,
      sunsetDay: null,
      attributionActorId: ctx.candidateId,
      sourceSubsystem: 'campaign',
    })
  })
  return out
}
