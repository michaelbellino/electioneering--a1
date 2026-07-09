/**
 * Playtest harness — an extended, instrumented version of scripts/balance.ts used for the
 * 2026-07 design review. Bots with different strategies play the real engine across seeds ×
 * difficulties × scenarios, and targeted experiments probe specific balance questions:
 * ad stacking, GOTV poll-invisibility, trait value, attack-ad systems, governing autoplay.
 *
 * Run: `npx tsx scripts/playtest.ts [experiment] [seedsPerCell]`
 * Experiments: matrix | scenarios | gotv | traits | adspam | attacks | governing | drama | all
 */
import { applyAction, createGame, tick, currentProfiles, type GameState } from '../src/engine/index'
import { effectiveElectorate } from '../src/engine/reducer'
import { evaluateElectorate } from '../src/engine/electorate/evaluate'
import { policySentiment } from '../src/engine/governing/governing'
import { agreementShare } from '../src/engine/electorate/opinion'
import { SCENARIOS } from '../src/data/scenarios/index'
import { HOUSE_SPECIAL_PA07 } from '../src/data/scenarios/houseSpecial'
import { DIFFICULTIES } from '../src/data/campaign/difficulties'
import { TRAITS } from '../src/data/campaign/traits'
import { POLICIES } from '../src/data/policies'
import type { Scenario } from '../src/engine/scenario'

type Act = Parameters<typeof applyAction>[1]

const A = (defId: string): Act => ({ type: 'campaign/action', payload: { defId } })
const HIRE = (staffId: string): Act => ({ type: 'campaign/hireStaff', payload: { staffId } })
const AD = (channel: string, tone: string, budget: number, policyId?: string): Act => ({
  type: 'campaign/runAd',
  payload: policyId ? { channel, tone, budget, policyId } : { channel, tone, budget },
})

// --- Bots --------------------------------------------------------------------

export type BotId =
  | 'idle'
  | 'grinder'
  | 'ground_game'
  | 'tv_spam'
  | 'media_mix'
  | 'quick_attacker'
  | 'desk_attacker'
  | 'machine'
  | 'machine_no_gotv'
  | 'machine_no_staff'

/** Most-vulnerable opponent policy (lowest district agreement with the opponent's stance). */
function bestAttackPolicy(s: GameState): string {
  const opp = s.candidates[s.election.candidateIds.find((id) => id !== s.playerCandidateId)!]!
  const e = effectiveElectorate(s)
  let best = POLICIES[0]!.id
  let bestAgree = Infinity
  for (const p of POLICIES) {
    const stance = opp.positions[p.areaId] ?? 0
    if (stance === 0) continue
    const agree = agreementShare(e, p.areaId, stance) + p.popularOffset * Math.sign(stance)
    if (agree < bestAgree) {
      bestAgree = agree
      best = p.id
    }
  }
  return best
}

/** One bot week: an ordered priority list of actions to ATTEMPT (engine rejects what it can't). */
function botWeek(bot: BotId, s: GameState, week: number): Act[] {
  const cash = s.campaign.finance.cash
  const poor = cash < 30_000_00
  switch (bot) {
    case 'idle':
      return []
    case 'grinder':
      return poor
        ? [A('fundraiser'), A('rally'), A('speech')]
        : [A('rally'), A('speech'), A('fundraiser')]
    case 'ground_game':
      return [A('canvass'), A('rally'), A('fundraiser')]
    case 'tv_spam': {
      // The 0-cooldown quick action: fundraise when poor, otherwise pure TV positive spam.
      const ads = Math.floor(Math.max(0, cash - 10_000_00) / 25_000_00)
      return poor
        ? [A('fundraiser'), A('tv_ad_positive'), A('speech')]
        : [A('fundraiser'), ...Array(Math.max(1, ads)).fill(A('tv_ad_positive'))]
    }
    case 'media_mix':
      // The Media desk, rotating channels to dodge fatigue.
      return poor
        ? [A('fundraiser'), AD('digital', 'positive', 1), A('speech')]
        : [
            A('fundraiser'),
            AD(week % 3 === 0 ? 'tv' : week % 3 === 1 ? 'radio' : 'digital', 'positive', 2),
            AD('digital', 'positive', 1),
          ]
    case 'quick_attacker':
      return poor
        ? [A('fundraiser'), A('tv_ad_attack'), A('speech')]
        : [A('fundraiser'), A('tv_ad_attack'), A('tv_ad_attack')]
    case 'desk_attacker': {
      const target = bestAttackPolicy(s)
      return poor
        ? [A('fundraiser'), AD('radio', 'attack', 1, target), A('speech')]
        : [A('fundraiser'), AD('tv', 'attack', 2, target), AD('radio', 'attack', 1, target)]
    }
    case 'machine':
    case 'machine_no_gotv':
    case 'machine_no_staff': {
      const acts: Act[] = []
      if (bot !== 'machine_no_staff') {
        if (week === 0) acts.push(HIRE('staff_manager'), HIRE('staff_fundraiser'))
        if (week === 1) acts.push(HIRE('staff_comms'), HIRE('staff_field'))
      }
      acts.push(A('fundraiser'))
      if (bot !== 'machine_no_gotv') acts.push(A('canvass'))
      acts.push(A('rally'))
      if (cash > 40_000_00) acts.push(A('tv_ad_positive'), A('tv_ad_positive'))
      acts.push(A('speech'))
      return acts
    }
  }
}

export interface RunResult {
  readonly won: boolean
  readonly playerShare: number
  readonly margin: number // player share − best rival share (signed)
  readonly finalCash: number
  readonly lastPollShare: number
  readonly pollLeadChanges: number
}

export function playBot(
  bot: BotId,
  difficultyId: string,
  seed: number,
  scenario: Scenario = HOUSE_SPECIAL_PA07,
  traitIds: string[] = [],
): RunResult {
  let s = createGame(scenario, seed, { difficultyId, traitIds })
  let week = 0
  for (; week < 80 && s.phase === 'campaign'; week++) {
    if (s.pendingDilemma) {
      s = applyAction(s, { type: 'campaign/resolveDilemma', payload: { optionId: 'accept' } })
    }
    for (const a of botWeek(bot, s, week)) s = applyAction(s, a)
    s = tick(s)
  }
  const pid = s.playerCandidateId
  const playerShare = s.result?.sharesByCandidate[pid] ?? 0
  const bestRival = Math.max(
    0,
    ...Object.entries(s.result?.sharesByCandidate ?? {})
      .filter(([id]) => id !== pid)
      .map(([, v]) => v),
  )
  let leadChanges = 0
  let ahead: boolean | null = null
  for (const p of s.polls) {
    const mine = p.shares[pid] ?? 0
    const theirs = Math.max(
      0,
      ...Object.entries(p.shares).filter(([id]) => id !== pid).map(([, v]) => v),
    )
    const nowAhead = mine > theirs
    if (ahead !== null && nowAhead !== ahead) leadChanges++
    ahead = nowAhead
  }
  return {
    won: s.result?.winnerIds[0] === pid,
    playerShare,
    margin: playerShare - bestRival,
    finalCash: s.campaign.finance.cash,
    lastPollShare: s.polls.at(-1)?.shares[pid] ?? 0,
    pollLeadChanges: leadChanges,
  }
}

// --- Reporting helpers ---------------------------------------------------------

const pct = (x: number): string => `${(x * 100).toFixed(0)}%`
const pts = (x: number): string => `${(x * 100).toFixed(1)}`

function cell(results: RunResult[]): string {
  const wr = results.filter((r) => r.won).length / results.length
  const m = results.reduce((a, r) => a + r.margin, 0) / results.length
  return `${pct(wr).padStart(4)} (${m >= 0 ? '+' : ''}${pts(m)})`.padEnd(14)
}

function seeds(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 1000 + i * 17)
}

// --- Experiments ----------------------------------------------------------------

function expMatrix(n: number): void {
  console.log(`\n=== MATRIX: win rate (mean margin, pts) — PA-07, ${n} seeds/cell ===`)
  const bots: BotId[] = ['idle', 'grinder', 'ground_game', 'tv_spam', 'media_mix', 'quick_attacker', 'desk_attacker', 'machine']
  console.log(['bot'.padEnd(16), ...DIFFICULTIES.map((d) => d.id.padEnd(14))].join(''))
  for (const bot of bots) {
    const row = DIFFICULTIES.map((d) => cell(seeds(n).map((s) => playBot(bot, d.id, s))))
    console.log([bot.padEnd(16), ...row].join(''))
  }
}

function expScenarios(n: number): void {
  console.log(`\n=== SCENARIOS: win rate (mean margin) on normal, ${n} seeds/cell ===`)
  const bots: BotId[] = ['grinder', 'machine']
  console.log(['scenario'.padEnd(28), 'stars', ...bots.map((b) => b.padEnd(14))].join(' '))
  for (const meta of SCENARIOS) {
    const row = bots.map((b) => cell(seeds(n).map((s) => playBot(b, 'normal', s, meta.scenario))))
    console.log([meta.scenario.id.padEnd(28), String(meta.stars).padEnd(5), ...row].join(' '))
  }
}

function expGotv(n: number): void {
  console.log(`\n=== GOTV: does canvassing show up anywhere? (normal, PA-07, ${n} seeds) ===`)
  for (const bot of ['machine', 'machine_no_gotv'] as BotId[]) {
    const rs = seeds(n).map((s) => playBot(bot, 'normal', s))
    const wr = rs.filter((r) => r.won).length / rs.length
    const m = rs.reduce((a, r) => a + r.margin, 0) / rs.length
    const pollErr = rs.reduce((a, r) => a + (r.playerShare - r.lastPollShare), 0) / rs.length
    console.log(
      `${bot.padEnd(16)} win ${pct(wr).padStart(4)}  mean margin ${pts(m).padStart(5)}  mean (result − last poll) ${pts(pollErr)} pts`,
    )
  }
}

function expTraits(n: number): void {
  console.log(`\n=== TRAITS: grinder, normal, PA-07, ${n} seeds — win rate / margin by single trait ===`)
  const base = seeds(n).map((s) => playBot('grinder', 'normal', s))
  console.log(`${'(none)'.padEnd(18)} ${cell(base)}`)
  for (const t of TRAITS) {
    const rs = seeds(n).map((s) => playBot('grinder', 'normal', s, HOUSE_SPECIAL_PA07, [t.id]))
    console.log(`${t.id.padEnd(18)} ${cell(rs)}`)
  }
}

function expAdSpam(): void {
  console.log(`\n=== AD STACKING: marginal true-share gain of the Nth ad in ONE week (seed 1000) ===`)
  const sandbox = { startingCash: 500_000_00, maxActionPoints: 14 }
  const shareAfter = (k: number, quick: boolean): number => {
    let s = createGame(HOUSE_SPECIAL_PA07, 1000, { difficultyId: 'normal', sandbox })
    for (let i = 0; i < k; i++) {
      s = quick
        ? applyAction(s, A('tv_ad_positive'))
        : applyAction(s, AD('tv', 'positive', 1))
    }
    s = tick(s)
    const shares = evaluateElectorate(effectiveElectorate(s), currentProfiles(s)).sharesByCandidate
    return shares[s.playerCandidateId] ?? 0
  }
  for (const quick of [true, false]) {
    const label = quick ? 'quick tv_ad_positive ($25k)' : 'media-desk TV budget-1'
    let prev = shareAfter(0, quick)
    const rows: string[] = []
    for (let k = 1; k <= 8; k++) {
      const now = shareAfter(k, quick)
      rows.push(`+${pts(now - prev)}`)
      prev = now
    }
    console.log(`${label.padEnd(28)} marginal pts per ad: ${rows.join(', ')}`)
  }
}

function expAttacks(n: number): void {
  console.log(`\n=== ATTACK SYSTEMS: quick attack (no backfire rule) vs media-desk attack (${n} seeds, normal) ===`)
  for (const bot of ['quick_attacker', 'desk_attacker'] as BotId[]) {
    const rs = seeds(n).map((s) => playBot(bot, 'normal', s))
    console.log(`${bot.padEnd(16)} ${cell(rs)}`)
  }
}

function expGoverning(n: number): void {
  console.log(`\n=== GOVERNING autoplay: 24-week legislator term, ${n} seeds ===`)
  type GovBot = 'aligned' | 'contrarian' | 'absent'
  const play = (bot: GovBot, seed: number): number => {
    let s = createGame(HOUSE_SPECIAL_PA07, seed, { startInOffice: true })
    for (let w = 0; w < 30 && s.phase === 'governing'; w++) {
      if (bot !== 'absent') {
        for (const bill of s.governing!.docket) {
          const yeaSent = policySentiment(s, bill.policyId, bill.direction)
          const vote = bot === 'aligned' ? (yeaSent > 0.5 ? 'yea' : 'nay') : yeaSent > 0.5 ? 'nay' : 'yea'
          s = applyAction(s, { type: 'gov/vote', payload: { billId: bill.id, vote } })
        }
      }
      s = applyAction(s, { type: 'gov/advanceWeek', payload: {} })
    }
    return s.governing!.approval
  }
  for (const bot of ['aligned', 'contrarian', 'absent'] as GovBot[]) {
    const finals = seeds(n).map((s) => play(bot, s))
    const mean = finals.reduce((a, b) => a + b, 0) / finals.length
    const min = Math.min(...finals)
    const max = Math.max(...finals)
    console.log(`${bot.padEnd(12)} mean approval ${pct(mean)}  range ${pct(min)}–${pct(max)}`)
  }
}

function expDrama(n: number): void {
  console.log(`\n=== DRAMA: poll lead changes + final margins (grinder, normal, ${n} seeds) ===`)
  const rs = seeds(n).map((s) => playBot('grinder', 'normal', s))
  const changes = rs.map((r) => r.pollLeadChanges)
  const margins = rs.map((r) => Math.abs(r.margin))
  const close = margins.filter((m) => m < 0.03).length
  console.log(
    `mean lead changes/run ${(changes.reduce((a, b) => a + b, 0) / n).toFixed(1)}; ` +
      `runs decided by <3 pts: ${close}/${n}; mean |margin| ${pts(margins.reduce((a, b) => a + b, 0) / n)} pts`,
  )
  const cash = rs.map((r) => r.finalCash / 100)
  console.log(`mean final cash $${Math.round(cash.reduce((a, b) => a + b, 0) / n).toLocaleString()}`)
}

function expFollowup(n: number): void {
  console.log(`\n=== FOLLOW-UP: traits on brutal (machine bot, ${n} seeds) ===`)
  const base = seeds(n).map((s) => playBot('machine', 'brutal', s))
  console.log(`${'(none)'.padEnd(18)} ${cell(base)}`)
  for (const t of TRAITS) {
    const rs = seeds(n).map((s) => playBot('machine', 'brutal', s, HOUSE_SPECIAL_PA07, [t.id]))
    console.log(`${t.id.padEnd(18)} ${cell(rs)}`)
  }

  console.log(`\n=== FOLLOW-UP: are the hard scenarios winnable at ANY difficulty? (machine, ${n} seeds) ===`)
  for (const meta of SCENARIOS.filter((m) => m.scenario.id !== 'house-special-pa07')) {
    const row = DIFFICULTIES.map((d) =>
      cell(seeds(n).map((s) => playBot('machine', d.id, s, meta.scenario))),
    )
    console.log([meta.scenario.id.padEnd(22), ...row].join(''))
  }

  console.log(`\n=== FOLLOW-UP: money slack (mean final unspent cash, normal) ===`)
  for (const bot of ['grinder', 'ground_game', 'machine'] as BotId[]) {
    const rs = seeds(n).map((s) => playBot(bot, 'normal', s))
    const cash = rs.reduce((a, r) => a + r.finalCash, 0) / n / 100
    console.log(`${bot.padEnd(16)} $${Math.round(cash).toLocaleString()}`)
  }
}

// --- CLI ----------------------------------------------------------------------

const exp = process.argv[2] ?? 'all'
const n = parseInt(process.argv[3] ?? '40', 10)
const t0 = Date.now()
if (exp === 'matrix' || exp === 'all') expMatrix(n)
if (exp === 'scenarios' || exp === 'all') expScenarios(Math.min(n, 25))
if (exp === 'gotv' || exp === 'all') expGotv(n)
if (exp === 'traits' || exp === 'all') expTraits(Math.min(n, 30))
if (exp === 'adspam' || exp === 'all') expAdSpam()
if (exp === 'attacks' || exp === 'all') expAttacks(n)
if (exp === 'governing' || exp === 'all') expGoverning(Math.min(n, 30))
if (exp === 'drama' || exp === 'all') expDrama(n)
if (exp === 'followup') expFollowup(Math.min(n, 30))
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`)
