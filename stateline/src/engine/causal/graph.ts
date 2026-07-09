/**
 * Build the live causal graph from GameState. PURE and RNG-FREE: same state → identical graph.
 *
 * Edge weights are finite-difference sensitivities of {@link evaluateElectorate}: perturb one input
 * (a lever, a platform position), re-evaluate the pure model, and record the vote-share delta. The
 * "true" (noise-free) share is used throughout — this is the model explaining itself, not a poll.
 */
import { CAMPAIGN_ACTIONS } from '../../data/campaign/actions'
import { ISSUE_DEFS, SEGMENT_DEFS } from '../../data/voterModel'
import type { IssueId } from '../../data/schema'
import { clamp, clamp01, formatUsd } from '../core/primitives'
import { evaluateElectorate } from '../electorate/evaluate'
import type { CandidateProfile, ElectorateState } from '../electorate/types'
import { deriveTurnoutBoostMap } from '../campaign/profile'
import { currentProfiles } from '../reducer'
import type { GameState } from '../state'
import type { CausalEdge, CausalGraph, CausalNode } from './types'

/** Perturbation step for lever/position sensitivities (small enough to be local, big enough to be stable). */
const DELTA = 0.05
/** Sensitivities are reported per this step size ("per +0.1"). */
const REPORT_STEP = 0.1
/** GOTV sensitivities are reported per this additive turnout boost (a typical canvass effect). */
const TURNOUT_STEP = 0.05
/** Issue→segment edges weaker than this (pts per +0.1) are omitted to keep the graph readable… */
const ISSUE_EDGE_FLOOR = 0.05
/** …but each issue keeps at least its strongest links so no issue node floats disconnected. */
const ISSUE_EDGES_MIN = 2
/** And at most this many, so a hot-button issue doesn't fan out to every segment. */
const ISSUE_EDGES_MAX = 3

export const LEVER_IDS = {
  awareness: 'lever:awareness',
  favorability: 'lever:favorability',
  oppFavorability: 'lever:opp_favorability',
  groundGame: 'lever:ground_game',
  warChest: 'lever:war_chest',
} as const

export const OUTCOME_ID = 'outcome:vote_share'

const actionId = (defId: string): string => `action:${defId}`
const issueNodeId = (id: IssueId): string => `issue:${id}`
const segmentNodeId = (id: string): string => `segment:${id}`

const pts = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pts`

interface EvalContext {
  electorate: ElectorateState
  profiles: CandidateProfile[]
  playerId: string
  playerIdx: number
  boost: Record<string, number>
}

function makeContext(state: GameState): EvalContext {
  const profiles = currentProfiles(state)
  const boost = deriveTurnoutBoostMap(
    state.ledger,
    state.calendar.dayIndex,
    state.election.jurisdictionId,
    state.electorate.groups,
    profiles,
  )
  return {
    electorate: state.electorate,
    profiles,
    playerId: state.playerCandidateId,
    playerIdx: profiles.findIndex((p) => p.candidateId === state.playerCandidateId),
    boost,
  }
}

/** Player's true (noise-free) share for a given set of profiles / boost map. */
function playerShare(ctx: EvalContext, profiles: readonly CandidateProfile[], boost = ctx.boost): number {
  return (
    evaluateElectorate(ctx.electorate, profiles, { turnoutBoost: boost }).sharesByCandidate[
      ctx.playerId
    ] ?? 0
  )
}

/** Replace one candidate's profile fields and return the new profile array. */
function withProfile(
  profiles: readonly CandidateProfile[],
  idx: number,
  patch: Partial<CandidateProfile>,
): CandidateProfile[] {
  return profiles.map((p, i) => (i === idx ? { ...p, ...patch } : p))
}

/**
 * ∂(player share)/∂(x) measured by a one-sided difference of size DELTA, reported in share POINTS per
 * `per` step of x. Steps down instead when x is at its upper clamp so the derivative stays local.
 */
function sensitivity(
  base: number,
  evalAt: (delta: number) => number,
  x: number,
  xMax: number,
  per: number,
): number {
  const d = x + DELTA <= xMax ? DELTA : -DELTA
  const dShare = evalAt(d) - base
  return ((dShare * 100) / d) * per // share points per `per` step (sign preserved by d)
}

/** Player's support share *within* a single voter group (softmax split; turnout cancels out). */
function inGroupShare(ctx: EvalContext, groupIdx: number, profiles: readonly CandidateProfile[]): number {
  const g = ctx.electorate.groups[groupIdx]!
  const sub: ElectorateState = { ...ctx.electorate, groups: [g], cvap: g.cvap }
  return evaluateElectorate(sub, profiles).sharesByCandidate[ctx.playerId] ?? 0
}

export function buildCausalGraph(state: GameState): CausalGraph {
  const ctx = makeContext(state)
  const player = ctx.profiles[ctx.playerIdx]!
  const base = playerShare(ctx, ctx.profiles)
  const nodes: CausalNode[] = []
  const edges: CausalEdge[] = []

  // ── Outcome ────────────────────────────────────────────────────────────────
  nodes.push({
    id: OUTCOME_ID,
    kind: 'outcome',
    label: 'Your vote share',
    value: base,
    valueLabel: `${(base * 100).toFixed(1)}%`,
    detail:
      'Your modeled share of the vote if the election were held today (noise-free — polls sample this with error).',
  })

  // ── Levers and their measured sensitivities ───────────────────────────────
  const sensAwareness = sensitivity(
    base,
    (d) => playerShare(ctx, withProfile(ctx.profiles, ctx.playerIdx, { awareness: clamp01(player.awareness + d) })),
    player.awareness,
    1,
    REPORT_STEP,
  )
  const sensFav = sensitivity(
    base,
    (d) => playerShare(ctx, withProfile(ctx.profiles, ctx.playerIdx, { favorability: clamp(player.favorability + d, -1, 1) })),
    player.favorability,
    1,
    REPORT_STEP,
  )
  // Opponent favorability: perturb every non-player candidate together.
  const oppIdxs = ctx.profiles.map((_, i) => i).filter((i) => i !== ctx.playerIdx)
  const sensOppFav = sensitivity(
    base,
    (d) =>
      playerShare(
        ctx,
        ctx.profiles.map((p, i) =>
          oppIdxs.includes(i) ? { ...p, favorability: clamp(p.favorability + d, -1, 1) } : p,
        ),
      ),
    Math.max(...oppIdxs.map((i) => ctx.profiles[i]!.favorability)),
    1,
    REPORT_STEP,
  )
  // Ground game: boost turnout in groups leaning toward the player's party (mirrors the engine's GOTV targeting).
  const playerDir = player.party === 'D' ? 1 : player.party === 'R' ? -1 : 0
  const gotvBoost = (d: number): Record<string, number> => {
    const b: Record<string, number> = { ...ctx.boost }
    for (const g of ctx.electorate.groups) {
      if (playerDir !== 0 && Math.sign(g.partisanLean) === playerDir) b[g.id] = (b[g.id] ?? 0) + d
    }
    return b
  }
  const sensGotv =
    ((playerShare(ctx, ctx.profiles, gotvBoost(DELTA)) - base) * 100 * TURNOUT_STEP) / DELTA

  const cash = state.campaign.finance.cash
  const levers: Array<{ id: string; label: string; value: number; valueLabel: string; detail: string; sens: number | null; sensLabel?: string }> = [
    {
      id: LEVER_IDS.awareness,
      label: 'Name recognition',
      value: player.awareness,
      valueLabel: `${Math.round(player.awareness * 100)}/100`,
      detail: 'Share of the electorate that knows you. Voters cannot choose a candidate they have never heard of.',
      sens: sensAwareness,
      sensLabel: `${pts(sensAwareness)} per +0.1`,
    },
    {
      id: LEVER_IDS.favorability,
      label: 'Your favorability',
      value: player.favorability,
      valueLabel: `${player.favorability >= 0 ? '+' : '−'}${Math.abs(player.favorability * 100).toFixed(0)}`,
      detail: 'Net favorability among voters who know you. Enters every voter group’s utility for you directly.',
      sens: sensFav,
      sensLabel: `${pts(sensFav)} per +0.1`,
    },
    {
      id: LEVER_IDS.oppFavorability,
      label: 'Opponent favorability',
      value: Math.max(...oppIdxs.map((i) => ctx.profiles[i]!.favorability)),
      valueLabel: `${(ctx.profiles[oppIdxs[0]!]?.favorability ?? 0) >= 0 ? '+' : '−'}${Math.abs((ctx.profiles[oppIdxs[0]!]?.favorability ?? 0) * 100).toFixed(0)}`,
      detail: 'Your opponent’s standing. Driving it down (attack ads) helps you — at some risk of blowback.',
      sens: sensOppFav,
      sensLabel: `${pts(sensOppFav)} per +0.1`,
    },
    {
      id: LEVER_IDS.groundGame,
      label: 'Ground game',
      value: sensGotv,
      valueLabel: `${pts(sensGotv)} per drive`,
      detail: 'GOTV turnout among groups that lean your way. Mobilizes supporters without persuading anyone.',
      sens: sensGotv,
      sensLabel: `${pts(sensGotv)} per +${TURNOUT_STEP} boost`,
    },
    {
      id: LEVER_IDS.warChest,
      label: 'War chest',
      value: cash,
      valueLabel: formatUsd(cash).replace(/\.\d\d$/, ''),
      detail: 'Cash on hand. Moves no votes by itself — it funds every paid action on the left.',
      sens: null,
    },
  ]
  for (const l of levers) {
    nodes.push({ id: l.id, kind: 'lever', label: l.label, value: l.value, valueLabel: l.valueLabel, detail: l.detail })
    if (l.sens !== null) {
      edges.push({
        source: l.id,
        target: OUTCOME_ID,
        kind: 'lever_sensitivity',
        weight: l.sens,
        label: l.sensLabel ?? pts(l.sens),
      })
    }
  }

  // ── Actions → levers (weights straight from content data) ─────────────────
  const CHANNEL_TO_LEVER: Record<string, { self: string; opponent: string }> = {
    nameRecognition: { self: LEVER_IDS.awareness, opponent: LEVER_IDS.awareness },
    favorability: { self: LEVER_IDS.favorability, opponent: LEVER_IDS.oppFavorability },
    turnout: { self: LEVER_IDS.groundGame, opponent: LEVER_IDS.groundGame },
  }
  for (const def of CAMPAIGN_ACTIONS) {
    nodes.push({
      id: actionId(def.id),
      kind: 'action',
      label: def.label,
      value: def.cashCost,
      valueLabel: def.fundraising
        ? `+${formatUsd(def.fundraising.baseAmount).replace(/\.\d\d$/, '')}`
        : `−${formatUsd(def.cashCost).replace(/\.\d\d$/, '')}`,
      detail: def.description,
    })
    for (const eff of def.effects) {
      const lever = CHANNEL_TO_LEVER[eff.channel]?.[eff.target]
      if (!lever) continue
      edges.push({
        source: actionId(def.id),
        target: lever,
        kind: 'action_effect',
        weight: eff.magnitude,
        label: `${eff.magnitude >= 0 ? '+' : '−'}${Math.abs(eff.magnitude)} ${eff.channel === 'nameRecognition' ? 'exposure' : eff.channel}${eff.target === 'opponent' ? ' (theirs)' : ''}`,
      })
    }
    if (def.fundraising) {
      edges.push({
        source: actionId(def.id),
        target: LEVER_IDS.warChest,
        kind: 'action_effect',
        weight: 1,
        label: `+${formatUsd(def.fundraising.baseAmount).replace(/\.\d\d$/, '')} per event`,
      })
    }
  }

  // ── Segments → outcome (vote weight, signed by who the group favors) ──────
  const groups = ctx.electorate.groups
  const groupShares = groups.map((_, gi) => inGroupShare(ctx, gi, ctx.profiles))
  const expectedVotes = groups.map((g) => {
    const rel = ctx.electorate.meanPropensity > 0 ? g.turnoutPropensity / ctx.electorate.meanPropensity : 1
    return g.cvap * clamp01(ctx.electorate.baselineTurnout * rel + (ctx.boost[g.id] ?? 0))
  })
  const totalExpected = expectedVotes.reduce((a, b) => a + b, 0)
  groups.forEach((g, gi) => {
    const def = SEGMENT_DEFS.find((s) => s.id === g.id)
    const share = groupShares[gi]!
    const voteWeight = totalExpected > 0 ? expectedVotes[gi]! / totalExpected : 0
    nodes.push({
      id: segmentNodeId(g.id),
      kind: 'segment',
      label: def?.label ?? g.id,
      value: share,
      valueLabel: `${(share * 100).toFixed(0)}% with you`,
      detail: `${(g.weight * 100).toFixed(0)}% of the electorate; casts ~${(voteWeight * 100).toFixed(0)}% of expected votes. Currently splits ${(share * 100).toFixed(0)}/${(100 - share * 100).toFixed(0)} your way.`,
    })
    edges.push({
      source: segmentNodeId(g.id),
      target: OUTCOME_ID,
      kind: 'segment_votes',
      weight: voteWeight * (share - 0.5) * 2, // signed: + if the group favors you
      label: `${(voteWeight * 100).toFixed(0)}% of votes · ${share >= 0.5 ? 'favors you' : 'favors opponent'} ${(share * 100).toFixed(0)}/${(100 - share * 100).toFixed(0)}`,
    })
  })

  // ── Issues → segments (measured position sensitivity per group) ───────────
  for (const issue of ISSUE_DEFS) {
    const posNow = player.positions[issue.id]
    const netSens = sensitivity(
      base,
      (d) =>
        playerShare(
          ctx,
          withProfile(ctx.profiles, ctx.playerIdx, {
            positions: { ...player.positions, [issue.id]: clamp(posNow + d, -1, 1) },
          }),
        ),
      posNow,
      1,
      REPORT_STEP,
    )
    nodes.push({
      id: issueNodeId(issue.id),
      kind: 'issue',
      label: issue.name,
      value: netSens,
      valueLabel: `${pts(netSens)} per +0.1 →`,
      detail: `Your position: ${posNow.toFixed(1)}. Moving progressive (+0.1) is worth ${pts(netSens)} overall. Poles: ${issue.leftPole} ↔ ${issue.rightPole}.`,
    })
    const candidateEdges = groups.map((g, gi) => {
      const baseIn = inGroupShare(ctx, gi, ctx.profiles)
      const d = posNow + DELTA <= 1 ? DELTA : -DELTA
      const perturbed = inGroupShare(
        ctx,
        gi,
        withProfile(ctx.profiles, ctx.playerIdx, {
          positions: { ...player.positions, [issue.id]: clamp(posNow + d, -1, 1) },
        }),
      )
      const w = (((perturbed - baseIn) * 100) / d) * REPORT_STEP // pts of in-group support per +0.1 progressive
      return { segmentId: g.id, w }
    })
    candidateEdges
      .slice()
      .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
      .filter((e, i) => i < ISSUE_EDGES_MIN || (i < ISSUE_EDGES_MAX && Math.abs(e.w) >= ISSUE_EDGE_FLOOR))
      .forEach((e) => {
        edges.push({
          source: issueNodeId(issue.id),
          target: segmentNodeId(e.segmentId),
          kind: 'issue_position',
          weight: e.w,
          label: `${pts(e.w)} in-group per +0.1 progressive`,
        })
      })
  }

  return { nodes, edges }
}
