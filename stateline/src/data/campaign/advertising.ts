/**
 * The advertising system (TPP-style): an ad buy is channel × tone × message × budget, not a single
 * button. Channels trade reach against cost and targeting; positive ads build you up, attack ads
 * target a specific opponent position (and BACKFIRE if the district actually agrees with it), and
 * issue ads wage the long war — shifting public opinion itself toward your position, capped per
 * campaign. Repeated buys on one channel fatigue it: the fifth TV ad moves less than the first.
 */
import type { Cents } from '../../engine/core/primitives'

export type AdChannel = 'tv' | 'radio' | 'digital' | 'mail'
export type AdTone = 'positive' | 'attack' | 'issue'
export type AdBudget = 1 | 2 | 3

export interface AdChannelDef {
  readonly id: AdChannel
  readonly label: string
  readonly blurb: string
  /** Cost at budget 1 for a ~560k-CVAP district; scales with budget and electorate size. */
  readonly baseCost: Cents
  /** Exposure (name recognition) magnitude at budget 1. */
  readonly awareness: number
  /** Favorability magnitude at budget 1. */
  readonly favorability: number
  /** Opinion-shift magnitude for issue ads at budget 1. */
  readonly opinion: number
  /** Direct mail can target one demographic segment (concentrated persuasion). */
  readonly targetable: boolean
}

export const AD_CHANNELS: readonly AdChannelDef[] = [
  {
    id: 'tv',
    label: 'Television',
    blurb: 'The big megaphone — reaches everyone, costs like it.',
    baseCost: 18_000_00,
    awareness: 0.45,
    favorability: 0.05,
    opinion: 0.02,
    targetable: false,
  },
  {
    id: 'radio',
    label: 'Radio',
    blurb: 'Drive-time persuasion at a working campaign’s price.',
    baseCost: 7_000_00,
    awareness: 0.2,
    favorability: 0.035,
    opinion: 0.015,
    targetable: false,
  },
  {
    id: 'digital',
    label: 'Digital',
    blurb: 'Cheap reach, shallow impressions — the name-recognition workhorse.',
    baseCost: 4_000_00,
    awareness: 0.3,
    favorability: 0.015,
    opinion: 0.008,
    targetable: false,
  },
  {
    id: 'mail',
    label: 'Direct Mail',
    blurb: 'A letter in one community of voters’ mailboxes. Narrow, deep, deniable.',
    baseCost: 6_000_00,
    awareness: 0.08,
    favorability: 0.05,
    opinion: 0.025,
    targetable: true,
  },
] as const

export function getAdChannel(id: string): AdChannelDef | undefined {
  return AD_CHANNELS.find((c) => c.id === id)
}

/** Fatigue: each buy on a channel this campaign multiplies later buys by 1/(1+RATE×n). */
export const AD_FATIGUE_RATE = 0.4
/** Public opinion can move at most this far (±) on one issue in one campaign (TPP's ±10 rule). */
export const OPINION_SHIFT_CAP = 0.08
/** Attack ads backfire when at least this share of the electorate agrees with the attacked position. */
export const ATTACK_BACKFIRE_THRESHOLD = 0.55

export function adCost(def: AdChannelDef, budget: AdBudget, cvap: number): Cents {
  const sizeScale = Math.sqrt(Math.max(0.25, cvap / 560_000))
  return Math.round(def.baseCost * budget * sizeScale)
}
