/**
 * Runtime-validated schemas for the game's REAL DATA layer.
 *
 * Two kinds of content live here:
 *   1. DEMOGRAPHICS (real, baked from the Census via the ETL): per-jurisdiction population, the share
 *      of each demographic segment, income/age, and a calibration target (`baselinePartisanLean`,
 *      `baselineTurnout`) derived from recent real election results.
 *   2. The VOTER MODEL (a calibrated *model*, hand-authored from political-science priors): for each
 *      demographic segment, its issue positions, issue salience, partisan lean, and turnout propensity.
 *
 * The simulation combines the two: a jurisdiction's electorate = its real segment composition × the
 * segment behavioural params, then nudged by a per-jurisdiction calibration offset so the modelled
 * baseline reproduces the jurisdiction's real recent lean. Demographics are the terrain; the voter
 * model is how that terrain votes.
 *
 * Everything is validated with Zod at load time so a malformed baked snapshot fails loudly rather than
 * silently corrupting the simulation.
 */
import { z } from 'zod'

export const ISSUE_IDS = [
  'taxes_spending',
  'healthcare',
  'immigration',
  'guns',
  'abortion',
  'climate_energy',
  'crime_policing',
  'social_culture',
] as const
export type IssueId = (typeof ISSUE_IDS)[number]

/** Direction convention: position/lean +1 = progressive/left/Democratic pole, −1 = conservative/right/Republican pole. */
export const IssueDefSchema = z.object({
  id: z.enum(ISSUE_IDS),
  name: z.string(),
  /** What the −1 pole means (e.g. "cut taxes & spending"). */
  leftPole: z.string(),
  /** What the +1 pole means (e.g. "raise taxes, expand services"). */
  rightPole: z.string(),
  /** Baseline national salience 0..1 before segment weighting. */
  baseSalience: z.number().min(0).max(1),
})
export type IssueDef = z.infer<typeof IssueDefSchema>

/** A demographic segment template (race × education grain in v1; expandable). */
export const SegmentDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Census-derived definition for documentation / ETL mapping. */
  censusBasis: z.string(),
})
export type SegmentDef = z.infer<typeof SegmentDefSchema>

const Signed1 = z.number().min(-1).max(1)
const Unit01 = z.number().min(0).max(1)

/** The calibrated behaviour of a demographic segment — the heart of "voter intention". */
export const SegmentBehaviorSchema = z.object({
  segmentId: z.string(),
  /** Net two-party lean of this segment nationally, −1 (solid R) .. +1 (solid D). */
  partisanLean: Signed1,
  /** Strength of party attachment 0..1 (how loyally the segment votes its lean vs. swings). */
  partisanStrength: Unit01,
  /** Mean issue position for the segment, per issue (−1..+1). */
  issuePositions: z.record(z.enum(ISSUE_IDS), Signed1),
  /** Per-issue salience multiplier for the segment (0..2, 1 = national average). */
  issueSalience: z.record(z.enum(ISSUE_IDS), z.number().min(0).max(2)),
  /** Baseline propensity to turn out, 0..1 (relative; scaled by jurisdiction baselineTurnout). */
  turnoutPropensity: Unit01,
})
export type SegmentBehavior = z.infer<typeof SegmentBehaviorSchema>

export const VoterModelSchema = z.object({
  modelVersion: z.string(),
  /** Provenance / methodology note (sources the priors were grounded in). */
  methodology: z.string(),
  issues: z.array(IssueDefSchema),
  segments: z.array(SegmentDefSchema),
  behavior: z.array(SegmentBehaviorSchema),
})
export type VoterModel = z.infer<typeof VoterModelSchema>

export const GovLevel = z.enum(['nation', 'state', 'congressional_district', 'county', 'municipality'])
export type GovLevel = z.infer<typeof GovLevel>

export const JurisdictionDemographicsSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: GovLevel,
  /** Real Census GEOID / FIPS where applicable (empty for synthetic nodes). */
  geoid: z.string(),
  parentId: z.string().nullable(),
  population: z.number().nonnegative(),
  /** Citizen voting-age population (turnout denominator). */
  cvap: z.number().nonnegative(),
  registeredVoters: z.number().nonnegative(),
  medianHouseholdIncome: z.number().nonnegative(),
  medianAge: z.number().nonnegative(),
  /** segmentId -> share of CVAP; should sum to ~1. */
  segmentShares: z.record(z.string(), Unit01),
  /** Recent real two-party lean, −1 (R) .. +1 (D) — the calibration target, NOT shown as live data. */
  baselinePartisanLean: Signed1,
  /** Recent real turnout as a fraction of CVAP. */
  baselineTurnout: Unit01,
  /** True while the figures are an approximate seed pending an ETL refresh from the Census API. */
  provisional: z.boolean().default(false),
})
export type JurisdictionDemographics = z.infer<typeof JurisdictionDemographicsSchema>

export const DemographicsDatasetSchema = z.object({
  dataVersion: z.string(),
  /** Human-readable provenance: which Census product + which election results calibrated the lean. */
  sources: z.array(z.string()),
  generatedNote: z.string(),
  jurisdictions: z.array(JurisdictionDemographicsSchema),
})
export type DemographicsDataset = z.infer<typeof DemographicsDatasetSchema>

/** Assert a jurisdiction's segment shares sum to ~1 (tolerance for rounding). */
export function segmentSharesSumOk(j: JurisdictionDemographics, tol = 0.02): boolean {
  const total = Object.values(j.segmentShares).reduce((a, b) => a + b, 0)
  return Math.abs(total - 1) <= tol
}
