/**
 * Campaign action definitions — the first MODDABLE content pack.
 *
 * Each action is pure data: cost, action-point cost, cooldown, and the effects it injects into the
 * effects ledger. The campaign reducer interprets these generically, so adding or modding an action is
 * adding data here (or in a content pack), never touching engine code. Money is integer cents.
 */
import type { CampaignActionDef } from '../../engine/campaign/types'

const USD = (dollars: number): number => Math.round(dollars * 100)

export const CAMPAIGN_ACTIONS: readonly CampaignActionDef[] = [
  {
    id: 'rally',
    label: 'Hold a Rally',
    category: 'event',
    description: 'Gather supporters for an energizing rally. Big name-recognition bump; some goodwill.',
    cashCost: USD(6000),
    actionPointCost: 1,
    cooldownDays: 10,
    amplifiedBy: 'field_director',
    effects: [
      { channel: 'nameRecognition', target: 'self', magnitude: 0.42, rampDurationDays: 3, decayHalfLifeDays: 28 },
      { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 3, decayHalfLifeDays: 21, tone: 0.6 },
      { channel: 'enthusiasm', target: 'self', magnitude: 0.02, rampDurationDays: 3, decayHalfLifeDays: 28, tone: 0.7 },
    ],
  },
  {
    id: 'tv_ad_positive',
    label: 'Run a Positive TV Ad',
    category: 'advertising',
    description:
      'Buy a positive ad buy. Strong reach for name recognition and favorability — but airtime tires: repeat TV buys land softer.',
    cashCost: USD(25000),
    actionPointCost: 1,
    cooldownDays: 0,
    amplifiedBy: 'comms_director',
    adChannel: 'tv',
    effects: [
      { channel: 'nameRecognition', target: 'self', magnitude: 0.7, rampDurationDays: 5, decayHalfLifeDays: 25 },
      { channel: 'favorability', target: 'self', magnitude: 0.08, rampDurationDays: 5, decayHalfLifeDays: 20, tone: 0.8 },
    ],
  },
  {
    id: 'tv_ad_attack',
    label: 'Run an Attack Ad',
    category: 'advertising',
    description:
      'Hit your opponent. Dents their favorability, demoralizes their base a little, and keeps your name in the fight — with some blowback.',
    cashCost: USD(20000),
    actionPointCost: 1,
    cooldownDays: 0,
    amplifiedBy: 'comms_director',
    adChannel: 'tv',
    effects: [
      { channel: 'favorability', target: 'opponent', magnitude: -0.12, rampDurationDays: 5, decayHalfLifeDays: 20, tone: -0.8 },
      { channel: 'enthusiasm', target: 'opponent', magnitude: -0.04, rampDurationDays: 5, decayHalfLifeDays: 21, tone: -0.8 },
      { channel: 'nameRecognition', target: 'self', magnitude: 0.28, rampDurationDays: 5, decayHalfLifeDays: 22 },
      { channel: 'favorability', target: 'self', magnitude: -0.02, rampDurationDays: 4, decayHalfLifeDays: 14, tone: -0.8 },
    ],
  },
  {
    id: 'speech',
    label: 'Give a Speech',
    category: 'message',
    description: 'Deliver a policy speech. Cheap, modest favorability and exposure.',
    cashCost: USD(1000),
    actionPointCost: 1,
    cooldownDays: 5,
    amplifiedBy: 'comms_director',
    effects: [
      { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 2, decayHalfLifeDays: 18, tone: 0.5 },
      { channel: 'nameRecognition', target: 'self', magnitude: 0.12, rampDurationDays: 2, decayHalfLifeDays: 20 },
    ],
  },
  {
    id: 'canvass',
    label: 'Canvass & GOTV',
    category: 'ground_game',
    description: 'Knock doors and bank votes. Boosts turnout among your supporters on election day.',
    cashCost: USD(3000),
    actionPointCost: 1,
    cooldownDays: 7,
    amplifiedBy: 'field_director',
    effects: [
      { channel: 'turnout', target: 'self', magnitude: 0.03, rampDurationDays: 7, decayHalfLifeDays: null },
    ],
  },
  {
    id: 'fundraiser',
    label: 'Host a Fundraiser',
    category: 'fundraising',
    description: 'Hold a donor event. Costs a little to host; raises a lot (more with a good fundraiser).',
    cashCost: USD(2000),
    actionPointCost: 1,
    cooldownDays: 9,
    amplifiedBy: 'fundraiser',
    fundraising: { baseAmount: USD(40000) },
    effects: [],
  },
] as const

export function getCampaignAction(id: string): CampaignActionDef | undefined {
  return CAMPAIGN_ACTIONS.find((a) => a.id === id)
}
