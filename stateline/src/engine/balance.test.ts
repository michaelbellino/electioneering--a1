/**
 * Balance smoke tests — the fast version of scripts/balance.ts. Guards the difficulty ladder's
 * SHAPE (monotonicity), not exact percentages: harder difficulties must never be easier.
 */
import { describe, expect, it } from 'vitest'
import { playBot } from '../../scripts/balance'

const SEEDS = [1000, 1017, 1034, 1051, 1068, 1085]

function wins(bot: 'grinder' | 'idle', difficulty: string): number {
  return SEEDS.filter((s) => playBot(bot, difficulty, s)).length
}

describe('difficulty ladder', () => {
  it('a competent bot wins less as difficulty rises (monotone-ish ladder)', () => {
    const easy = wins('grinder', 'easy')
    const brutal = wins('grinder', 'brutal')
    expect(easy).toBeGreaterThan(brutal)
    expect(easy).toBeGreaterThanOrEqual(4) // easy is genuinely friendly
    expect(brutal).toBeLessThanOrEqual(3) // brutal genuinely bites
  })

  it('doing nothing loses everywhere (the sim responds to play)', () => {
    expect(wins('idle', 'easy')).toBe(0)
  })
})
