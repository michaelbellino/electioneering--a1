/**
 * AI candidates — comprehensive opponents that PLAY THE GAME, not scripts. Every AI candidate has
 * a war chest, a personality, and a weekly turn in which it reads the race (the same true shares
 * the polls sample), then allocates a budget of moves across the same levers the player has:
 * fundraising, positive/attack advertising, and traveling the map to rally on the ground.
 * Deterministic: every choice comes from a forked, seeded RNG stream per candidate per week.
 */
import type { Cents, EntityId } from '../core/primitives'
import { clamp01 } from '../core/primitives'
import type { DayIndex } from '../core/calendar'
import { forkRng, Rng } from '../core/rng'
import type { ScheduledEffect } from '../core/ledger'
import { agreementShare } from '../electorate/opinion'
import type { CandidateProfile, ElectorateState } from '../electorate/types'
import type { TerritoryState } from '../territory/generate'
import { getCommunity } from '../territory/generate'
import { ISSUE_IDS } from '../../data/schema'

export type AiPersonality = 'frontrunner' | 'attack_dog' | 'insurgent'

export interface AiCandidateState {
  readonly candidateId: EntityId
  readonly personality: AiPersonality
  readonly cash: Cents
  readonly location: string
}

export interface AiTurnResult {
  readonly ai: AiCandidateState
  readonly effects: readonly ScheduledEffect[]
  /** Presence bumps to apply, communityId -> amount. */
  readonly presence: Readonly<Record<string, number>>
  readonly logLine: string
}

interface AiTurnCtx {
  readonly day: DayIndex
  readonly ledgerLength: number
  readonly jurisdictionId: EntityId
  /** Difficulty-scaled global intensity (the old aiOpponentIntensity). */
  readonly intensity: number
  readonly territory: TerritoryState
  readonly profiles: readonly CandidateProfile[]
  readonly shares: Readonly<Record<EntityId, number>>
  readonly rngBase: Parameters<typeof forkRng>[0]
  /** When provided, the AI aims its attacks at the rival's least-popular stance. */
  readonly electorate?: ElectorateState
}

const USD = (d: number): Cents => Math.round(d * 100)

function eff(
  ctx: AiTurnCtx,
  who: EntityId,
  target: EntityId,
  n: number,
  channel: 'nameRecognition' | 'favorability' | 'enthusiasm',
  magnitude: number,
  decay: number,
  tone: number,
): ScheduledEffect {
  return {
    id: `eff:ai:${who}:${ctx.day}:${n}`,
    target: { kind: 'electorate', jurisdictionId: ctx.jurisdictionId, candidateId: target, channel, tone },
    op: 'add',
    magnitude,
    enactedDay: ctx.day,
    rampStartDays: 0,
    rampDurationDays: 3,
    decayHalfLifeDays: decay,
    sunsetDay: null,
    attributionActorId: who,
    sourceSubsystem: 'campaign',
  }
}

/** Personality → weekly move weights [fundraise, positiveAd, attackAd, groundGame]. */
const PLAYBOOK: Record<AiPersonality, [number, number, number, number]> = {
  frontrunner: [0.3, 0.35, 0.1, 0.25],
  attack_dog: [0.2, 0.15, 0.45, 0.2],
  insurgent: [0.25, 0.1, 0.15, 0.5],
}

export function runAiTurn(ai: AiCandidateState, ctx: AiTurnCtx): AiTurnResult {
  const rng = new Rng(forkRng(ctx.rngBase, `ai:${ai.candidateId}:${ctx.day}`))
  const me = ctx.profiles.find((p) => p.candidateId === ai.candidateId)!
  const myShare = ctx.shares[ai.candidateId] ?? 0
  // The rival to beat: whoever holds the biggest share that isn't me.
  const rival = Object.entries(ctx.shares)
    .filter(([id]) => id !== ai.candidateId)
    .sort((a, b) => b[1] - a[1])[0]
  const rivalId = rival?.[0] ?? ai.candidateId
  const trailing = (rival?.[1] ?? 0) - myShare // positive = I'm behind

  let cash = ai.cash
  let location = ai.location
  const effects: ScheduledEffect[] = []
  const presence: Record<string, number> = {}
  const did: string[] = []
  let n = 0

  // Trailing candidates get desperate: shift weight from positive to attack + ground.
  const [wFund, wPos, wAtk, wGround] = PLAYBOOK[ai.personality]
  const desperation = clamp01(trailing * 3)
  const weights = [
    wFund + (cash < USD(20_000) ? 0.35 : 0),
    wPos * (1 - desperation * 0.5),
    wAtk + desperation * 0.25,
    wGround + desperation * 0.1,
  ]

  // Where is the rival's platform weakest with THIS electorate? (Smart targeting — hard+ AIs.)
  const rivalProfile = ctx.profiles.find((p) => p.candidateId === rivalId)
  let attackAim = 1
  if (ctx.electorate && rivalProfile && ctx.intensity > 0.65) {
    let worstAgree = 1
    for (const issue of ISSUE_IDS) {
      const stance = rivalProfile.positions[issue] ?? 0
      if (Math.abs(stance) < 0.05) continue
      const agree = agreementShare(ctx.electorate, issue, stance)
      if (agree < worstAgree) worstAgree = agree
    }
    attackAim = 0.6 + (1 - worstAgree) // ≈1.1 vs a sturdy platform, up to ~1.6 vs a weak one
  }

  // Harder opponents simply work harder: 3 moves, 4 on hard, 5 on brutal.
  const moves = ctx.intensity > 0.85 ? 5 : ctx.intensity > 0.65 ? 4 : 3
  for (let m = 0; m < moves; m++) {
    const total = weights.reduce((a, b) => a + b, 0)
    let x = rng.float() * total
    let pick = 0
    for (let i = 0; i < weights.length; i++) {
      x -= weights[i]!
      if (x < 0) {
        pick = i
        break
      }
    }
    if (pick === 0) {
      // Fundraise: haul scales with their fundraising attribute and how known they are.
      const haul = Math.round(USD(25_000) * (0.6 + me.awareness) * (0.5 + (rng.float() * 0.4 + 0.6) * ctx.intensity))
      cash += haul
      did.push('fundraised')
    } else if (pick === 1 && cash >= USD(15_000)) {
      cash -= USD(15_000)
      effects.push(eff(ctx, ai.candidateId, ai.candidateId, n++, 'nameRecognition', 0.35 * ctx.intensity * 3.4, 25, 0.6))
      effects.push(eff(ctx, ai.candidateId, ai.candidateId, n++, 'favorability', 0.05 * ctx.intensity * 3.4, 20, 0.7))
      did.push('ran positive ads')
    } else if (pick === 2 && cash >= USD(12_000)) {
      cash -= USD(12_000)
      effects.push(eff(ctx, ai.candidateId, rivalId, n++, 'favorability', -0.07 * ctx.intensity * 3.4 * attackAim, 20, -0.7))
      // Demobilization: attacks keep the rival's voters home, and being on offense earns coverage.
      effects.push(eff(ctx, ai.candidateId, rivalId, n++, 'enthusiasm', -0.03 * ctx.intensity * 3.4 * attackAim, 21, -0.7))
      effects.push(eff(ctx, ai.candidateId, ai.candidateId, n++, 'nameRecognition', 0.12 * ctx.intensity * 3.4, 22, 0))
      effects.push(eff(ctx, ai.candidateId, ai.candidateId, n++, 'favorability', -0.01, 14, -0.7))
      did.push(`attacked ${rivalId === ctx.profiles[0]?.candidateId ? 'you' : 'a rival'}`)
    } else {
      // Ground game: hop the map (weighted toward big communities) and rally there. Hard+ AIs
      // shadow the player half the time — contesting the places you've organized hardest.
      const here = getCommunity(ctx.territory, location)
      const playerStronghold = Object.entries(ctx.territory.presence).sort((a, b) => b[1] - a[1])[0]?.[0]
      const pool =
        ctx.intensity > 0.65 && playerStronghold && rng.bool(0.5)
          ? [playerStronghold]
          : rng.bool(0.25)
            ? ctx.territory.communities.map((c) => c.id)
            : [location, ...(here?.neighbors ?? [])]
      const ws = pool.map((id) => getCommunity(ctx.territory, id)?.weight ?? 0.01)
      const tw = ws.reduce((a, b) => a + b, 0)
      let y = rng.float() * tw
      for (let i = 0; i < pool.length; i++) {
        y -= ws[i]!
        if (y < 0) {
          location = pool[i]!
          break
        }
      }
      const reach = Math.min(1.5, 0.6 + (getCommunity(ctx.territory, location)?.weight ?? 0.05) * 4.5)
      effects.push(eff(ctx, ai.candidateId, ai.candidateId, n++, 'nameRecognition', 0.35 * ctx.intensity * 3.2 * reach, 30, 0.5))
      presence[location] = (presence[location] ?? 0) + 0.3
      did.push(`rallied in ${getCommunity(ctx.territory, location)?.name ?? 'town'}`)
    }
  }

  const uniq = [...new Set(did)]
  return {
    ai: { ...ai, cash, location },
    effects,
    presence,
    logLine: uniq.join(', '),
  }
}
