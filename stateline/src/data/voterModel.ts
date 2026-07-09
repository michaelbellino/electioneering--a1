/**
 * The calibrated VOTER MODEL: how each demographic segment thinks and votes.
 *
 * These parameters are a *model*, hand-authored from well-established political-science patterns
 * (the education & racial "diploma divide", differential turnout propensity, issue-ownership and
 * salience research; the kind of patterns visible in ANES/CES surveys and network exit polls). They
 * are deliberately tunable: the engine fits a per-jurisdiction calibration offset on top so that the
 * modelled baseline reproduces each real jurisdiction's recent lean. Treat the numbers as priors to be
 * refined against data, not ground truth.
 *
 * Direction convention everywhere: +1 = progressive / Democratic pole, −1 = conservative / Republican.
 */
import { VoterModelSchema, type IssueId, type VoterModel } from './schema'

const ISSUES = [
  {
    id: 'taxes_spending',
    name: 'Taxes & Spending',
    leftPole: 'cut taxes, shrink government',
    rightPole: 'raise taxes, expand public services',
    baseSalience: 0.9,
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    leftPole: 'market-based, private',
    rightPole: 'universal / public option',
    baseSalience: 0.85,
  },
  {
    id: 'immigration',
    name: 'Immigration',
    leftPole: 'restrictive, border-first',
    rightPole: 'open, path to citizenship',
    baseSalience: 0.8,
  },
  {
    id: 'guns',
    name: 'Guns',
    leftPole: 'gun rights',
    rightPole: 'gun control',
    baseSalience: 0.6,
  },
  {
    id: 'abortion',
    name: 'Abortion',
    leftPole: 'pro-life / restrict',
    rightPole: 'pro-choice / protect',
    baseSalience: 0.75,
  },
  {
    id: 'climate_energy',
    name: 'Climate & Energy',
    leftPole: 'fossil fuels, deregulate',
    rightPole: 'climate action, clean energy',
    baseSalience: 0.6,
  },
  {
    id: 'crime_policing',
    name: 'Crime & Policing',
    leftPole: 'tough-on-crime',
    rightPole: 'reform / rehabilitation',
    baseSalience: 0.7,
  },
  {
    id: 'social_culture',
    name: 'Social & Cultural',
    leftPole: 'traditional values',
    rightPole: 'progressive values',
    baseSalience: 0.65,
  },
] as const

const SEGMENTS = [
  { id: 'white_college', label: 'White, college-educated', censusBasis: 'White NH × BA+' },
  { id: 'white_noncollege', label: 'White, no college degree', censusBasis: 'White NH × < BA' },
  { id: 'black', label: 'Black', censusBasis: 'Black alone or in combination' },
  { id: 'hispanic', label: 'Hispanic / Latino', censusBasis: 'Hispanic of any race' },
  { id: 'asian', label: 'Asian', censusBasis: 'Asian alone or in combination' },
  { id: 'other', label: 'Other / Multiracial / Native', censusBasis: 'AIAN, NHPI, other, two+ races' },
] as const

type IssueMap = Record<IssueId, number>

const pos = (m: Partial<IssueMap>): IssueMap => ({
  taxes_spending: 0,
  healthcare: 0,
  immigration: 0,
  guns: 0,
  abortion: 0,
  climate_energy: 0,
  crime_policing: 0,
  social_culture: 0,
  ...m,
})
const sal = (m: Partial<IssueMap>): IssueMap => ({
  taxes_spending: 1,
  healthcare: 1,
  immigration: 1,
  guns: 1,
  abortion: 1,
  climate_energy: 1,
  crime_policing: 1,
  social_culture: 1,
  ...m,
})

export const VOTER_MODEL: VoterModel = VoterModelSchema.parse({
  modelVersion: '0.1.0',
  methodology:
    'Hand-authored priors grounded in published US voting patterns (education/racial diploma divide, ' +
    'differential turnout, issue salience by group). Tunable; per-jurisdiction calibration offset fits ' +
    'the modelled baseline to recent real two-party results. Not derived from any individual voter file.',
  issues: [...ISSUES],
  segments: [...SEGMENTS],
  behavior: [
    {
      segmentId: 'white_college',
      partisanLean: 0.08,
      partisanStrength: 0.42,
      turnoutPropensity: 0.8,
      issuePositions: pos({
        taxes_spending: 0.1,
        healthcare: 0.15,
        immigration: 0.2,
        guns: 0.25,
        abortion: 0.4,
        climate_energy: 0.45,
        crime_policing: 0.1,
        social_culture: 0.35,
      }),
      issueSalience: sal({ abortion: 1.3, climate_energy: 1.3, social_culture: 1.2, taxes_spending: 0.9 }),
    },
    {
      segmentId: 'white_noncollege',
      partisanLean: -0.36,
      partisanStrength: 0.55,
      turnoutPropensity: 0.63,
      issuePositions: pos({
        taxes_spending: -0.2,
        healthcare: -0.05,
        immigration: -0.45,
        guns: -0.4,
        abortion: -0.2,
        climate_energy: -0.25,
        crime_policing: -0.35,
        social_culture: -0.4,
      }),
      issueSalience: sal({ immigration: 1.4, guns: 1.3, crime_policing: 1.2, social_culture: 1.2 }),
    },
    {
      segmentId: 'black',
      partisanLean: 0.74,
      partisanStrength: 0.78,
      turnoutPropensity: 0.62,
      issuePositions: pos({
        taxes_spending: 0.4,
        healthcare: 0.5,
        immigration: 0.25,
        guns: 0.3,
        abortion: 0.25,
        climate_energy: 0.3,
        crime_policing: 0.45,
        social_culture: 0.2,
      }),
      issueSalience: sal({ healthcare: 1.3, crime_policing: 1.4, taxes_spending: 1.1 }),
    },
    {
      segmentId: 'hispanic',
      partisanLean: 0.28,
      partisanStrength: 0.42,
      turnoutPropensity: 0.48,
      issuePositions: pos({
        taxes_spending: 0.25,
        healthcare: 0.35,
        immigration: 0.35,
        guns: 0.1,
        abortion: 0.05,
        climate_energy: 0.2,
        crime_policing: 0.1,
        social_culture: 0.0,
      }),
      issueSalience: sal({ immigration: 1.4, healthcare: 1.2, taxes_spending: 1.1 }),
    },
    {
      segmentId: 'asian',
      partisanLean: 0.34,
      partisanStrength: 0.4,
      turnoutPropensity: 0.55,
      issuePositions: pos({
        taxes_spending: 0.15,
        healthcare: 0.3,
        immigration: 0.3,
        guns: 0.25,
        abortion: 0.3,
        climate_energy: 0.3,
        crime_policing: 0.05,
        social_culture: 0.2,
      }),
      issueSalience: sal({ healthcare: 1.2, immigration: 1.2 }),
    },
    {
      segmentId: 'other',
      partisanLean: 0.16,
      partisanStrength: 0.4,
      turnoutPropensity: 0.5,
      issuePositions: pos({
        taxes_spending: 0.2,
        healthcare: 0.3,
        immigration: 0.2,
        guns: 0.15,
        abortion: 0.2,
        climate_energy: 0.3,
        crime_policing: 0.3,
        social_culture: 0.15,
      }),
      issueSalience: sal({ healthcare: 1.1, climate_energy: 1.1 }),
    },
  ],
})

export const ISSUE_DEFS = VOTER_MODEL.issues
export const SEGMENT_DEFS = VOTER_MODEL.segments
