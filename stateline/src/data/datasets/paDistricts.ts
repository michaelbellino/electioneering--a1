/**
 * All 17 Pennsylvania congressional districts (2022+ map), authored as provisional seeds in the
 * exact ETL shape (like demographics.seed.ts): realistic approximations of segment mix, lean, and
 * turnout per district, to be overwritten by the Census ETL later. Leans use this codebase's
 * −1..+1 scale calibrated against the existing anchors (PA-07 ≈ +0.02 tossup, TX-13 ≈ −0.7 safe R).
 */
import type { DemographicsDataset } from '../schema'

type J = DemographicsDataset['jurisdictions'][number]

interface Row {
  n: number
  name: string
  lean: number
  turnout: number
  income: number
  age: number
  // segment shares: [white_college, white_noncollege, black, hispanic, asian, other]
  seg: [number, number, number, number, number, number]
}

// Approximate district profiles: Philly urban, collar suburbs, and the rural T.
const ROWS: Row[] = [
  { n: 1, name: 'PA-01 — Bucks County', lean: 0.01, turnout: 0.63, income: 96000, age: 43, seg: [0.38, 0.42, 0.04, 0.08, 0.05, 0.03] },
  { n: 2, name: 'PA-02 — Northeast Philadelphia', lean: 0.55, turnout: 0.48, income: 60000, age: 37, seg: [0.16, 0.24, 0.2, 0.28, 0.09, 0.03] },
  { n: 3, name: 'PA-03 — West & Central Philadelphia', lean: 0.9, turnout: 0.52, income: 55000, age: 34, seg: [0.2, 0.08, 0.55, 0.08, 0.06, 0.03] },
  { n: 4, name: 'PA-04 — Montgomery County', lean: 0.32, turnout: 0.66, income: 104000, age: 42, seg: [0.44, 0.31, 0.09, 0.07, 0.06, 0.03] },
  { n: 5, name: 'PA-05 — Delaware County', lean: 0.4, turnout: 0.63, income: 86000, age: 40, seg: [0.36, 0.3, 0.21, 0.06, 0.05, 0.02] },
  { n: 6, name: 'PA-06 — Chester County & Reading', lean: 0.15, turnout: 0.65, income: 98000, age: 41, seg: [0.4, 0.33, 0.06, 0.15, 0.04, 0.02] },
  { n: 7, name: 'PA-07 — Lehigh Valley', lean: 0.02, turnout: 0.54, income: 70300, age: 40, seg: [0.26, 0.42, 0.06, 0.18, 0.04, 0.04] },
  { n: 8, name: 'PA-08 — Scranton / Wilkes-Barre', lean: -0.05, turnout: 0.58, income: 60000, age: 43, seg: [0.22, 0.56, 0.05, 0.13, 0.02, 0.02] },
  { n: 9, name: 'PA-09 — Northeast Anthracite Country', lean: -0.55, turnout: 0.57, income: 58000, age: 44, seg: [0.16, 0.68, 0.04, 0.09, 0.01, 0.02] },
  { n: 10, name: 'PA-10 — Harrisburg & York', lean: -0.1, turnout: 0.6, income: 68000, age: 40, seg: [0.28, 0.48, 0.11, 0.08, 0.03, 0.02] },
  { n: 11, name: 'PA-11 — Lancaster County', lean: -0.3, turnout: 0.61, income: 72000, age: 39, seg: [0.24, 0.54, 0.05, 0.12, 0.03, 0.02] },
  { n: 12, name: 'PA-12 — Pittsburgh', lean: 0.35, turnout: 0.6, income: 62000, age: 38, seg: [0.34, 0.38, 0.17, 0.04, 0.05, 0.02] },
  { n: 13, name: 'PA-13 — South-Central Valleys', lean: -0.65, turnout: 0.59, income: 58000, age: 44, seg: [0.16, 0.72, 0.03, 0.06, 0.01, 0.02] },
  { n: 14, name: 'PA-14 — Southwestern Corner', lean: -0.45, turnout: 0.6, income: 62000, age: 44, seg: [0.2, 0.68, 0.05, 0.03, 0.02, 0.02] },
  { n: 15, name: 'PA-15 — The Central T', lean: -0.6, turnout: 0.58, income: 56000, age: 44, seg: [0.18, 0.72, 0.03, 0.04, 0.01, 0.02] },
  { n: 16, name: 'PA-16 — Erie & the Northwest', lean: -0.4, turnout: 0.59, income: 58000, age: 43, seg: [0.19, 0.68, 0.06, 0.04, 0.01, 0.02] },
  { n: 17, name: 'PA-17 — Allegheny Suburbs', lean: 0.06, turnout: 0.66, income: 84000, age: 42, seg: [0.38, 0.44, 0.08, 0.03, 0.04, 0.03] },
]

const SEG_IDS = ['white_college', 'white_noncollege', 'black', 'hispanic', 'asian', 'other'] as const

export const PA_DISTRICTS: J[] = ROWS.filter((r) => r.n !== 7).map((r) => ({
  id: `us-pa-cd${String(r.n).padStart(2, '0')}`,
  name: r.name,
  level: 'congressional_district' as const,
  geoid: `42${String(r.n).padStart(2, '0')}`,
  parentId: 'us-pa',
  population: 764000,
  cvap: 565000,
  registeredVoters: 505000,
  medianHouseholdIncome: r.income,
  medianAge: r.age,
  segmentShares: Object.fromEntries(SEG_IDS.map((id, i) => [id, r.seg[i]!])) as Record<string, number>,
  baselinePartisanLean: r.lean,
  baselineTurnout: r.turnout,
  provisional: true,
}))
