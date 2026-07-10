/**
 * GOVERNING — the second half of the loop, first slice. Win (or skip straight to) the office and
 * the gameplay changes shape by office type:
 *
 *  - LEGISLATOR (House/Senate): a weekly docket of generated bills. You cast votes; approval moves
 *    by how each vote sits with the district (agreement × salience). Many small decisions.
 *  - EXECUTIVE (Governor): you set the agenda — one big executive action a week that you OWN.
 *    Bigger approval swings, and every action carries an implementation roll next week
 *    (competence-mitigated): executives get credit for outcomes, not positions.
 *
 * Pure and deterministic like everything else: dockets and implementation rolls come from forked
 * seeded RNG streams. Approval is the score; the term report is the verdict.
 */
import { clamp01 } from '../core/primitives'
import { forkRng, Rng } from '../core/rng'
import type { GameState } from '../state'
import { agreementShare } from '../electorate/opinion'
import { getPolicy, POLICIES, type PolicyDef } from '../../data/policies'
import { ISSUE_DEFS } from '../../data/voterModel'

export type OfficeKind = 'legislator' | 'executive'

export interface BillItem {
  readonly id: string
  readonly title: string
  readonly policyId: string
  /** +1 = the bill advances the progressive side of the policy, −1 the conservative side. */
  readonly direction: 1 | -1
  /**
   * Your staff's read on district support for the bill's direction (0..1) — a NOISY estimate,
   * not the truth. The roll-call reaction tells you what the district really thought.
   */
  readonly estimate: number
}

export interface RecordEntry {
  readonly week: number
  readonly text: string
  /** Approval delta this entry produced (display). */
  readonly delta: number
}

export interface PendingOutcome {
  readonly policyId: string
  readonly week: number
}

export interface GoverningState {
  readonly office: OfficeKind
  readonly title: string
  readonly week: number
  readonly termWeeks: number
  /** Job approval 0..1 — the score. */
  readonly approval: number
  /** Political capital: earned by governing well; the whip/agenda currency of the full phase. */
  readonly capital: number
  /** Legislator: this week's docket. Executive: this week's agenda options. */
  readonly docket: readonly BillItem[]
  /** Executive only: last week's action awaiting its implementation roll. */
  readonly pendingOutcome: PendingOutcome | null
  readonly record: readonly RecordEntry[]
}

const TERM_WEEKS = 24

function billTitle(p: PolicyDef, direction: 1 | -1): string {
  return `${direction > 0 ? p.proLabel : p.conLabel} — ${p.label}`
}

function drawDocket(state: GameState, week: number, count: number): BillItem[] {
  const rng = new Rng(forkRng(state.rng.events!, `docket:${week}`))
  const picks: BillItem[] = []
  const pool = [...POLICIES]
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length - 1)
    const p = pool.splice(idx, 1)[0]!
    const direction: 1 | -1 = rng.bool(0.5) ? 1 : -1
    // The staff whip estimate: right on average, off by enough to make close calls real decisions.
    const estimate = clamp01(policySentiment(state, p.id, direction) + rng.normal(0, 0.07))
    picks.push({
      id: `bill:${week}:${p.id}`,
      title: billTitle(p, direction),
      policyId: p.id,
      direction,
      estimate,
    })
  }
  return picks
}

export function createGoverning(state: GameState, office: OfficeKind, title: string): GoverningState {
  return {
    office,
    title,
    week: 1,
    termWeeks: TERM_WEEKS,
    approval: 0.52,
    capital: 3,
    docket: drawDocket(state, 1, office === 'legislator' ? 2 : 3),
    pendingOutcome: null,
    record: [],
  }
}

/** How the district feels about taking `direction` on this policy (0..1 agreement). */
export function policySentiment(state: GameState, policyId: string, direction: 1 | -1): number {
  const p = getPolicy(policyId)
  if (!p) return 0.5
  const agree = agreementShare(state.electorate, p.areaId, direction) + p.popularOffset * direction
  return clamp01(agree)
}

function salienceOf(policyId: string): number {
  const p = getPolicy(policyId)
  const area = ISSUE_DEFS.find((i) => i.id === p?.areaId)
  return (area?.baseSalience ?? 0.7) * (p?.weight ?? 0.33)
}

/** Legislator: cast a vote on a docket bill. */
export function castVote(
  state: GameState,
  gov: GoverningState,
  billId: string,
  vote: 'yea' | 'nay',
): GoverningState {
  const bill = gov.docket.find((b) => b.id === billId)
  if (!bill) return gov
  const dir = vote === 'yea' ? bill.direction : (-bill.direction as 1 | -1)
  const sentiment = policySentiment(state, bill.policyId, dir)
  let delta = (sentiment - 0.5) * salienceOf(bill.policyId) * 0.25
  const aligned = sentiment > 0.55
  // Conviction: voting against the platform you RAN on angers the base — flip-flops carry a
  // cost on top of whatever the district thinks of the vote itself.
  const areaId = getPolicy(bill.policyId)?.areaId
  const ownStance = areaId ? (state.candidates[state.playerCandidateId]?.positions[areaId] ?? 0) : 0
  const flipFlop = Math.abs(ownStance) >= 0.25 && Math.sign(ownStance) !== Math.sign(dir)
  if (flipFlop) delta -= 0.012
  return {
    ...gov,
    approval: clamp01(gov.approval + delta),
    capital: gov.capital + (aligned ? 1 : 0),
    docket: gov.docket.filter((b) => b.id !== billId),
    record: [
      ...gov.record,
      {
        week: gov.week,
        text: `Voted ${vote.toUpperCase()} on "${bill.title}" (${Math.round(sentiment * 100)}% of the district agrees${flipFlop ? ' — but your base calls it a betrayal of your platform' : ''}).`,
        delta,
      },
    ],
  }
}

/** Political-capital spends — the currency finally buys something. */
export const CAPITAL_SPENDS = {
  town_hall: {
    cost: 3,
    approval: 0.012,
    label: 'Hold a town hall',
    blurb: 'Face the district, take the heat, bank a little goodwill.',
    record: 'Held a town hall — showed up, took questions, won some respect.',
  },
  district_grant: {
    cost: 5,
    approval: 0.022,
    label: 'Steer a district grant',
    blurb: 'Call in favors to land a project back home. Expensive, memorable.',
    record: 'Steered a state grant into the district — ribbon cuttings make friends.',
  },
} as const
export type CapitalSpendKind = keyof typeof CAPITAL_SPENDS

/** Spend banked political capital on the district. No-op if you can't afford it. */
export function spendCapital(gov: GoverningState, kind: CapitalSpendKind): GoverningState {
  const spec = CAPITAL_SPENDS[kind]
  if (!spec || gov.capital < spec.cost) return gov
  return {
    ...gov,
    capital: gov.capital - spec.cost,
    approval: clamp01(gov.approval + spec.approval),
    record: [...gov.record, { week: gov.week, text: spec.record, delta: spec.approval }],
  }
}

/** Executive: take one agenda action this week — you own the outcome. */
export function executiveAction(
  state: GameState,
  gov: GoverningState,
  billId: string,
): GoverningState {
  const item = gov.docket.find((b) => b.id === billId)
  if (!item || gov.pendingOutcome) return gov
  const sentiment = policySentiment(state, item.policyId, item.direction)
  const delta = (sentiment - 0.5) * salienceOf(item.policyId) * 0.5
  return {
    ...gov,
    approval: clamp01(gov.approval + delta),
    docket: [],
    pendingOutcome: { policyId: item.policyId, week: gov.week },
    record: [
      ...gov.record,
      {
        week: gov.week,
        text: `Signed: "${item.title}" (${Math.round(sentiment * 100)}% approve of the direction). Implementation pending…`,
        delta,
      },
    ],
  }
}

/** Advance one governing week: resolve implementation rolls, drift, redraw the docket. */
export function tickGoverning(state: GameState, gov: GoverningState): GoverningState {
  const week = gov.week + 1
  let approval = gov.approval
  let capital = gov.capital + 1
  const record: RecordEntry[] = [...gov.record]

  // Executive implementation roll: competence decides whether last week's action delivered.
  let pendingOutcome = gov.pendingOutcome
  if (pendingOutcome) {
    const rng = new Rng(forkRng(state.rng.events!, `impl:${pendingOutcome.week}:${pendingOutcome.policyId}`))
    const competence = state.candidates[state.playerCandidateId]?.attributes.competence ?? 0.5
    const p = getPolicy(pendingOutcome.policyId)
    if (rng.bool(0.5 * (1 - competence))) {
      const delta = -0.035
      approval = clamp01(approval + delta)
      record.push({ week, text: `Rollout of the ${p?.label ?? 'program'} stumbled — implementation problems led the news.`, delta })
    } else {
      const delta = 0.025
      approval = clamp01(approval + delta)
      capital += 2
      record.push({ week, text: `The ${p?.label ?? 'program'} rollout is working. Competence is its own campaign ad.`, delta })
    }
    pendingOutcome = null
  }

  // Unspent docket expires (legislators who skip votes look absent).
  if (gov.office === 'legislator' && gov.docket.length > 0) {
    const delta = -0.008 * gov.docket.length
    approval = clamp01(approval + delta)
    record.push({ week, text: `Missed ${gov.docket.length} vote${gov.docket.length > 1 ? 's' : ''}. The absence rate makes the local paper.`, delta })
  }

  // Approval drifts gently toward neutral (complacency cuts both ways).
  approval = approval + (0.5 - approval) * 0.03

  return {
    ...gov,
    week,
    approval,
    capital,
    pendingOutcome,
    docket: drawDocket(state, week, gov.office === 'legislator' ? 2 : 3),
    record,
  }
}

export function termVerdict(gov: GoverningState): { grade: string; text: string } {
  const a = gov.approval
  if (a >= 0.62) return { grade: 'Landslide territory', text: 'The district would re-elect you tomorrow. The party is asking about higher office.' }
  if (a >= 0.54) return { grade: 'Safe seat', text: 'Solid, popular, re-electable. Donors return your calls.' }
  if (a >= 0.46) return { grade: 'On the bubble', text: 'A real race next cycle. Every vote you cast will be in the attack ads.' }
  if (a >= 0.38) return { grade: 'Endangered', text: 'Primary challengers are circling. The party chair stopped smiling.' }
  return { grade: 'One-termer', text: 'The only question is who retires you.' }
}
