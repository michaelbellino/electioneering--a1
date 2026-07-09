/**
 * Balance harness — bots play the game across seeds × difficulties × strategies and report win
 * rates. Run: `npx tsx scripts/balance.ts [seeds-per-cell]`. The engine is deterministic, so this
 * is the ground truth for tuning: difficulty targets are easy ~75%, normal ~50%, hard ~30%,
 * brutal ~10% for a competent (not perfect) bot.
 */
import { applyAction, createGame, tick, type GameState } from '../src/engine/index'
import { HOUSE_SPECIAL_PA07 } from '../src/data/scenarios/houseSpecial'
import { DIFFICULTIES } from '../src/data/campaign/difficulties'

export type BotId = 'grinder' | 'ad_man' | 'ground_game' | 'idle'

/** One bot week: returns the actions to attempt in order (engine rejects what it can't afford). */
function botWeek(bot: BotId, s: GameState): Array<Parameters<typeof applyAction>[1]> {
  const cash = s.campaign.finance.cash
  const poor = cash < 30_000_00
  switch (bot) {
    case 'grinder':
      return poor
        ? [{ type: 'campaign/action', payload: { defId: 'fundraiser' } }, { type: 'campaign/action', payload: { defId: 'rally' } }, { type: 'campaign/action', payload: { defId: 'speech' } }]
        : [{ type: 'campaign/action', payload: { defId: 'rally' } }, { type: 'campaign/action', payload: { defId: 'speech' } }, { type: 'campaign/action', payload: { defId: 'fundraiser' } }]
    case 'ad_man':
      return poor
        ? [{ type: 'campaign/action', payload: { defId: 'fundraiser' } }, { type: 'campaign/runAd', payload: { channel: 'digital', tone: 'positive', budget: 1 } }]
        : [{ type: 'campaign/runAd', payload: { channel: 'tv', tone: 'positive', budget: 2 } }, { type: 'campaign/action', payload: { defId: 'fundraiser' } }, { type: 'campaign/runAd', payload: { channel: 'digital', tone: 'positive', budget: 1 } }]
    case 'ground_game':
      return [
        { type: 'campaign/action', payload: { defId: 'canvass' } },
        { type: 'campaign/action', payload: { defId: 'rally' } },
        { type: 'campaign/action', payload: { defId: 'fundraiser' } },
      ]
    case 'idle':
      return []
  }
}

export function playBot(bot: BotId, difficultyId: string, seed: number): boolean {
  let s = createGame(HOUSE_SPECIAL_PA07, seed, { difficultyId })
  for (let week = 0; week < 60 && s.phase === 'campaign'; week++) {
    if (s.pendingDilemma) {
      // Competent-but-simple: always take the first (usually bolder) option.
      s = applyAction(s, { type: 'campaign/resolveDilemma', payload: { optionId: 'accept' } })
    }
    for (const a of botWeek(bot, s)) s = applyAction(s, a)
    s = tick(s)
  }
  return s.result?.winnerIds[0] === s.playerCandidateId
}

export function winRates(seedsPerCell: number): Record<string, Record<BotId, number>> {
  const bots: BotId[] = ['grinder', 'ad_man', 'ground_game', 'idle']
  const out: Record<string, Record<BotId, number>> = {}
  for (const d of DIFFICULTIES) {
    out[d.id] = { grinder: 0, ad_man: 0, ground_game: 0, idle: 0 }
    for (const bot of bots) {
      let wins = 0
      for (let i = 0; i < seedsPerCell; i++) {
        if (playBot(bot, d.id, 1000 + i * 17)) wins++
      }
      out[d.id]![bot] = wins / seedsPerCell
    }
  }
  return out
}

// CLI entry (skipped under vitest import).
const isCli = typeof process !== 'undefined' && process.argv[1]?.endsWith('balance.ts')
if (isCli) {
  const n = parseInt(process.argv[2] ?? '25', 10)
  console.log(`Balance report — PA-07 tossup, ${n} seeds per cell\n`)
  const rates = winRates(n)
  const bots: BotId[] = ['grinder', 'ad_man', 'ground_game', 'idle']
  console.log(['difficulty'.padEnd(10), ...bots.map((b) => b.padEnd(12))].join(''))
  for (const [d, row] of Object.entries(rates)) {
    console.log([d.padEnd(10), ...bots.map((b) => `${Math.round(row[b] * 100)}%`.padEnd(12))].join(''))
  }
}
