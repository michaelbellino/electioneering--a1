/**
 * Plain-language briefings that surface the simulation's real, normally-hidden mechanics at the point
 * of decision. Sourced from the engine itself (profile.ts valence, evaluate.ts weights, advertising.ts
 * fatigue/backfire, logic.ts fundraising, difficulties.ts point-buy). Kept terse and honest.
 */
import type { TraitDef } from '@data/campaign/traits'

export const BRIEF: Record<string, string> = {
  quality:
    'How voters rate you beyond party and name recognition. Quality = 0.3 + 0.4·Charisma + 0.3·Competence + 0.1·Integrity. It enters the vote model at weight 0.9 — but party loyalty weighs 2.6, and no one votes for a candidate they have never heard of.',
  attributes:
    'Charisma drives Quality most and powers rallies, debates and hostile rooms. Competence carries policy fights and steadies you in a scandal. Integrity resists scandal. Fundraising is separate — it only raises money. Points cost more at the top: 1 each up to 6, 2 for 7–8, 3 for 9–10.',
  background:
    'Two picks, each a genuine tradeoff — never strictly better. A bonus to an attribute you have already maxed (100) is wasted, and a penalty can pull you below what you paid for.',
  platform:
    '24 stances across 8 areas — open an area to take each policy individually. Every demographic group weighs the issues differently, so there is no universally best platform: voters judge how close you are on the issues they personally care about.',
  party:
    'Partisanship is the strongest force in the model (weight 2.6 vs 0.9 for Quality). An Independent forgoes a party base and starts uphill; in a safe seat the same-party primary is the real election.',
  nameRec:
    'Name recognition gates everything: a candidate nobody knows wins almost no votes, however good. It saturates — early ads and rallies move it most — and your opponent usually starts better-known. Closing that gap is most of the campaign.',
  favorability:
    'Net approval, −100 to +100, weighing 0.9 in the vote model. Rallies, positive ads and speeches raise it; attack ads and scandals cut it. Scandal bites twice — it also lowers Quality.',
  warChest:
    'Cash buys ads, staff, offices and ground game. A small-dollar trickle arrives weekly (bigger with Fundraising and a Finance Director), but the real money is fundraisers — and each one you hold tires your donors, shrinking the next haul.',
  team:
    'One hire per role. A Campaign Manager grants +1 action point the moment you hire and shortens every cooldown. Others amplify their specialty: Comms slows ad fatigue, Oppo Research makes attacks hit harder and backfire less, a Pollster buys bigger, cheaper polls.',
  actions:
    'Rallies, speeches and canvassing happen where you are standing and land hardest in big media markets; ads and fundraising are district-wide. Attack ads can backfire when the district already agrees with what you are attacking.',
  raceWire:
    'Your read on the field. War-chest figures are rounded estimates — commission an opponent poll to sharpen them and reveal a rival’s playbook. You can always see where rivals are standing, but not a town’s real numbers until you canvass it.',
  polling:
    'A sampled likely-voter estimate of the true race, with real sampling noise — the margin of error shrinks with a Pollster’s bigger samples. It prices in the turnout picture too, so canvassing and enthusiasm show up here. The wobble you see is the poll, not the electorate.',
}

const ATTR_NAME: Record<string, string> = {
  charisma: 'charisma',
  competence: 'competence',
  integrity: 'integrity',
  fundraising: 'fundraising',
}

/** Format a trait's raw def fields into an exact, human-readable effect line (generic, always correct). */
export function traitEffectLine(t: TraitDef): string {
  const parts: string[] = []
  const pts = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))}`
  for (const [k, v] of Object.entries(t.attributes ?? {})) {
    if (v) parts.push(`${pts(v)} ${ATTR_NAME[k] ?? k}`)
  }
  if (t.baseExposure) parts.push(`${pts(t.baseExposure)} name rec`)
  if (t.baseFavorability) parts.push(`${pts(t.baseFavorability)} favorability`)
  if (t.cashDelta) {
    const d = Math.round(t.cashDelta / 100)
    parts.push(`${d > 0 ? '+' : '−'}$${Math.abs(d).toLocaleString('en-US')} cash`)
  }
  if (t.apDelta) parts.push(`${t.apDelta > 0 ? '+' : ''}${t.apDelta} AP/week`)
  if (t.salaryMult && t.salaryMult !== 1) parts.push(`${Math.round((t.salaryMult - 1) * 100)}% staff pay`)
  if (t.scandalMult && t.scandalMult !== 1) parts.push(`${Math.round((t.scandalMult - 1) * 100)}% scandal damage`)
  return parts.join(' · ')
}
