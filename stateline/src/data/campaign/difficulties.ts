/**
 * Difficulty levels — pure data, Democracy-style global knobs. A difficulty never adds rules; it
 * rescales the same simulation (creation budget, money, action economy, opponent aggression, event
 * pressure) so every level is fair, just tighter.
 */

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'brutal'

export interface DifficultyDef {
  readonly id: DifficultyId
  readonly label: string
  readonly description: string
  /** Candidate-creation point budget (see traits.ts for costs). */
  readonly pointBudget: number
  /** Multiplier on the scenario's starting cash. */
  readonly cashMult: number
  /** Multiplier on the opponent AI's campaigning intensity. */
  readonly opponentMult: number
  /** Action points per week. */
  readonly maxActionPoints: number
  /** Chance a dilemma lands on your desk each week. */
  readonly dilemmaChance: number
}

export const DIFFICULTIES: readonly DifficultyDef[] = [
  {
    id: 'easy',
    label: 'Front-runner',
    description: 'Deep pockets, a sleepy opponent, a forgiving press. Learn the ropes.',
    pointBudget: 30,
    cashMult: 1.5,
    opponentMult: 0.6,
    maxActionPoints: 4,
    dilemmaChance: 0.35,
  },
  {
    id: 'normal',
    label: 'The Grind',
    description: 'A fair fight. Every dollar and every week has to work.',
    pointBudget: 24,
    cashMult: 1,
    opponentMult: 1,
    maxActionPoints: 3,
    dilemmaChance: 0.45,
  },
  {
    id: 'hard',
    label: 'Uphill',
    description: 'Outspent and outgunned. The fundamentals are not your friend.',
    pointBudget: 20,
    cashMult: 0.7,
    opponentMult: 1.35,
    maxActionPoints: 3,
    dilemmaChance: 0.55,
  },
  {
    id: 'brutal',
    label: 'Sacrificial Lamb',
    description: 'The party needed a name on the ballot. Shock the world.',
    pointBudget: 16,
    cashMult: 0.5,
    opponentMult: 1.7,
    maxActionPoints: 2,
    dilemmaChance: 0.65,
  },
] as const

export function getDifficulty(id: string): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]!
}

/**
 * Point-buy cost of setting an attribute to `step` (0..10, value = step/10): cheap up to 6, then
 * escalating — a 10 costs real sacrifice elsewhere. Total for [6,6,6,5] ≈ the old default ≈ 23.
 */
export function attributeCost(step: number): number {
  let cost = 0
  for (let s = 1; s <= step; s++) cost += s <= 6 ? 1 : s <= 8 ? 2 : 3
  return cost
}

export function totalAttributeCost(steps: readonly number[]): number {
  return steps.reduce((a, s) => a + attributeCost(s), 0)
}
