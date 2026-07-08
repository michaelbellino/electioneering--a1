/**
 * Public opinion shifts — the long war. Issue advertising moves the ELECTORATE's positions toward
 * yours (capped per campaign, TPP-style), not just your own numbers. Pure transform: the shifted
 * electorate is derived on demand from base data + the shift map in GameState.
 */
import { clamp } from '../core/primitives'
import type { ElectorateState } from './types'

export type OpinionShifts = Readonly<Record<string, number>>

/** Apply capped per-issue opinion shifts to every voter group's positions. */
export function shiftedElectorate(electorate: ElectorateState, shifts: OpinionShifts): ElectorateState {
  const entries = Object.entries(shifts).filter(([, v]) => v !== 0)
  if (entries.length === 0) return electorate
  return {
    ...electorate,
    groups: electorate.groups.map((g) => {
      const positions = { ...g.issuePositions }
      for (const [issueId, delta] of entries) {
        if (issueId in positions) {
          positions[issueId as keyof typeof positions] = clamp(
            (positions[issueId as keyof typeof positions] ?? 0) + delta,
            -1,
            1,
          )
        }
      }
      return { ...g, issuePositions: positions }
    }),
  }
}

/** Share of the (turnout-weighted) electorate whose position on `issueId` matches `sign`. */
export function agreementShare(electorate: ElectorateState, issueId: string, sign: number): number {
  let agree = 0
  let total = 0
  for (const g of electorate.groups) {
    const w = g.weight
    total += w
    const pos = g.issuePositions[issueId as keyof typeof g.issuePositions] ?? 0
    if (Math.sign(pos) === Math.sign(sign) && Math.abs(pos) > 0.05) agree += w
  }
  return total > 0 ? agree / total : 0
}
