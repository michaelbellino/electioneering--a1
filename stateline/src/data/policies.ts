/**
 * The POLICY layer (TPP-style depth): under each of the 8 calibrated issue AREAS sit concrete,
 * named policy positions. A candidate's platform is 28 specific stances, not 8 sliders:
 * the engine's calibrated area position = the salience-weighted aggregate of your policy stances,
 * and your fiscal/social ideology scores are computed from them. Ads and polls target specific
 * policies; each policy carries a district-agnostic popularity offset (some positions poll better
 * than their area: background checks outpoll "gun control" generally).
 *
 * Direction convention everywhere: +1 = progressive pole, −1 = conservative pole.
 */
import type { IssueId } from './schema'
import { ISSUE_IDS } from './schema'

export interface PolicyDef {
  readonly id: string
  readonly areaId: IssueId
  readonly label: string
  /** What a +1 (progressive) stance means ↔ what a −1 stance means. */
  readonly proLabel: string
  readonly conLabel: string
  /** Weight of this policy inside its area aggregate (sums ~1 per area). */
  readonly weight: number
  /**
   * Popularity offset: how much friendlier the district is to the PROGRESSIVE side of this policy
   * than to its area overall (+ = the progressive stance overperforms its area).
   */
  readonly popularOffset: number
  /** Contribution to ideology axes (fiscal vs social), 0..1 each. */
  readonly fiscal: number
  readonly social: number
}

const P = (
  id: string, areaId: IssueId, label: string, proLabel: string, conLabel: string,
  weight: number, popularOffset: number, fiscal: number, social: number,
): PolicyDef => ({ id, areaId, label, proLabel, conLabel, weight, popularOffset, fiscal, social })

export const POLICIES: readonly PolicyDef[] = [
  // Taxes & spending
  P('tax_wealthy', 'taxes_spending', 'Taxes on high earners', 'Raise top rates', 'Cut top rates', 0.35, 0.15, 1, 0),
  P('tax_middle', 'taxes_spending', 'Middle-class taxes', 'Expand credits', 'Across-the-board cuts', 0.3, 0.1, 1, 0),
  P('spending_programs', 'taxes_spending', 'Social program spending', 'Expand programs', 'Cut and balance', 0.35, -0.05, 1, 0),
  // Healthcare
  P('public_option', 'healthcare', 'Public health option', 'Create one', 'Keep private-only', 0.4, 0.1, 0.8, 0.2),
  P('drug_prices', 'healthcare', 'Drug price negotiation', 'Negotiate prices', 'Market pricing', 0.3, 0.25, 0.8, 0.2),
  P('medicaid_expand', 'healthcare', 'Medicaid expansion', 'Expand eligibility', 'Tighten eligibility', 0.3, 0.05, 0.9, 0.1),
  // Immigration
  P('citizenship_path', 'immigration', 'Path to citizenship', 'Create a path', 'No amnesty', 0.35, 0, 0.2, 0.8),
  P('border_security', 'immigration', 'Border enforcement', 'Humane processing', 'Harden the border', 0.4, -0.2, 0.2, 0.8),
  P('legal_migration', 'immigration', 'Legal immigration levels', 'Raise caps', 'Lower caps', 0.25, 0.05, 0.4, 0.6),
  // Guns
  P('background_checks', 'guns', 'Universal background checks', 'Require them', 'Oppose new checks', 0.4, 0.3, 0, 1),
  P('assault_weapons', 'guns', 'Assault-weapons ban', 'Ban sales', 'Protect sales', 0.35, -0.05, 0, 1),
  P('carry_laws', 'guns', 'Concealed carry', 'Stricter permits', 'Constitutional carry', 0.25, -0.1, 0, 1),
  // Abortion
  P('abortion_legality', 'abortion', 'Legality', 'Protect access', 'Restrict access', 0.5, 0.1, 0, 1),
  P('abortion_funding', 'abortion', 'Public funding', 'Fund coverage', 'No public funding', 0.25, -0.15, 0.3, 0.7),
  P('abortion_late', 'abortion', 'Later-term limits', 'Physician discretion', 'Strict limits', 0.25, -0.2, 0, 1),
  // Climate & energy
  P('clean_energy', 'climate_energy', 'Clean-energy investment', 'Invest big', 'Let markets decide', 0.35, 0.15, 0.6, 0.4),
  P('fossil_leases', 'climate_energy', 'Drilling & pipelines', 'Wind down', 'Expand production', 0.35, -0.15, 0.6, 0.4),
  P('carbon_price', 'climate_energy', 'Carbon pricing', 'Price carbon', 'No carbon tax', 0.3, -0.1, 0.8, 0.2),
  // Crime & policing
  P('police_funding', 'crime_policing', 'Police budgets', 'Reallocate to services', 'Fund the police', 0.35, -0.25, 0.3, 0.7),
  P('sentencing', 'crime_policing', 'Sentencing reform', 'Reduce mandatory minimums', 'Tough sentencing', 0.35, 0.05, 0.2, 0.8),
  P('drug_policy', 'crime_policing', 'Drug policy', 'Treat, not jail', 'Enforce hard', 0.3, 0.15, 0.3, 0.7),
  // Social & cultural
  P('lgbtq_rights', 'social_culture', 'LGBTQ protections', 'Expand protections', 'Religious exemptions', 0.35, 0.05, 0, 1),
  P('school_curriculum', 'social_culture', 'School curriculum', 'Local educator control', 'Parental review boards', 0.35, -0.1, 0, 1),
  P('voting_access', 'social_culture', 'Voting access', 'Expand early/mail voting', 'Tighten ID rules', 0.3, 0.1, 0.2, 0.8),
] as const

export type PolicyStances = Record<string, number>

export function getPolicy(id: string): PolicyDef | undefined {
  return POLICIES.find((p) => p.id === id)
}

export function policiesForArea(areaId: IssueId): PolicyDef[] {
  return POLICIES.filter((p) => p.areaId === areaId)
}

/** Aggregate 28 policy stances into the engine's 8 calibrated area positions. */
export function aggregateToAreas(stances: PolicyStances): Record<IssueId, number> {
  const out = {} as Record<IssueId, number>
  for (const area of ISSUE_IDS) {
    const ps = policiesForArea(area)
    const totalW = ps.reduce((a, p) => a + p.weight, 0) || 1
    out[area] = ps.reduce((a, p) => a + (stances[p.id] ?? 0) * p.weight, 0) / totalW
  }
  return out
}

/** Fill all 28 stances from 8 area positions (the "quick platform" path). */
export function stancesFromAreas(areas: Partial<Record<IssueId, number>>): PolicyStances {
  return Object.fromEntries(POLICIES.map((p) => [p.id, areas[p.areaId] ?? 0]))
}

export interface IdeologyScores {
  /** −1 (staunch fiscal conservative) .. +1 (staunch fiscal progressive). */
  fiscal: number
  social: number
}

export function ideologyOf(stances: PolicyStances): IdeologyScores {
  let f = 0
  let fw = 0
  let s = 0
  let sw = 0
  for (const p of POLICIES) {
    const v = stances[p.id] ?? 0
    f += v * p.fiscal * p.weight
    fw += p.fiscal * p.weight
    s += v * p.social * p.weight
    sw += p.social * p.weight
  }
  return { fiscal: fw > 0 ? f / fw : 0, social: sw > 0 ? s / sw : 0 }
}

export function ideologyLabel(v: number): string {
  const mag = Math.abs(v)
  if (mag < 0.1) return 'Centrist'
  const dir = v > 0 ? 'progressive' : 'conservative'
  return mag < 0.35 ? `Lean ${dir}` : mag < 0.65 ? `Solidly ${dir}` : `Staunchly ${dir}`
}
