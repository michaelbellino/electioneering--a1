/**
 * Baked demographics snapshot (SEED).
 *
 * These records have the EXACT shape the ETL emits and real Census GEOIDs, but the figures are
 * approximate seeds (`provisional: true`) authored to be realistic, not exact. Running
 * `CENSUS_API_KEY=… npm run etl:demographics` overwrites this file with exact ACS values and a
 * results-calibrated lean. The simulation never fetches at runtime — it loads this baked snapshot, so
 * play is deterministic and offline. See docs/data-pipeline.md.
 *
 * Congressional-district populations are ~761k (2020 apportionment). Segment shares are of CVAP.
 */
import type { DemographicsDataset } from '../schema'
import { PA_DISTRICTS } from './paDistricts'

export const DEMOGRAPHICS_SEED: DemographicsDataset = {
  dataVersion: 'seed-0.1.0',
  sources: [
    'US Census Bureau ACS 5-year (shape/target of ETL output) — figures here are provisional seeds',
    'Two-party baseline lean calibrated to recent US House/presidential results (provisional)',
  ],
  generatedNote:
    'Provisional hand-authored seed. Replace with `npm run etl:demographics` once CENSUS_API_KEY is set.',
  jurisdictions: [
    {
      id: 'us-pa',
      name: 'Pennsylvania',
      level: 'state',
      geoid: '42',
      parentId: 'us',
      population: 12972000,
      cvap: 9700000,
      registeredVoters: 8900000,
      medianHouseholdIncome: 73170,
      medianAge: 40.9,
      segmentShares: {
        white_college: 0.28,
        white_noncollege: 0.45,
        black: 0.1,
        hispanic: 0.08,
        asian: 0.04,
        other: 0.05,
      },
      baselinePartisanLean: 0.012,
      baselineTurnout: 0.66,
      provisional: true,
    },
    {
      id: 'us-pa-cd07',
      name: "Pennsylvania's 7th Congressional District",
      level: 'congressional_district',
      geoid: '4207',
      parentId: 'us-pa',
      population: 761000,
      cvap: 560000,
      registeredVoters: 510000,
      medianHouseholdIncome: 70300,
      medianAge: 40.2,
      segmentShares: {
        white_college: 0.26,
        white_noncollege: 0.42,
        black: 0.06,
        hispanic: 0.18,
        asian: 0.04,
        other: 0.04,
      },
      baselinePartisanLean: 0.02, // genuine tossup / very slight D — the playable race
      baselineTurnout: 0.54,
      provisional: true,
    },
    {
      id: 'us-ny-cd13',
      name: "New York's 13th Congressional District",
      level: 'congressional_district',
      geoid: '3613',
      parentId: 'us-ny',
      population: 776000,
      cvap: 520000,
      registeredVoters: 430000,
      medianHouseholdIncome: 55600,
      medianAge: 36.4,
      segmentShares: {
        white_college: 0.12,
        white_noncollege: 0.05,
        black: 0.25,
        hispanic: 0.5,
        asian: 0.06,
        other: 0.02,
      },
      baselinePartisanLean: 0.8, // safe Democratic (Upper Manhattan / Bronx)
      baselineTurnout: 0.46,
      provisional: true,
    },
    {
      id: 'us-tx-cd13',
      name: "Texas's 13th Congressional District",
      level: 'congressional_district',
      geoid: '4813',
      parentId: 'us-tx',
      population: 767000,
      cvap: 540000,
      registeredVoters: 430000,
      medianHouseholdIncome: 58900,
      medianAge: 37.1,
      segmentShares: {
        white_college: 0.18,
        white_noncollege: 0.5,
        black: 0.06,
        hispanic: 0.22,
        asian: 0.02,
        other: 0.02,
      },
      baselinePartisanLean: -0.7, // safe Republican (Texas Panhandle)
      baselineTurnout: 0.56,
      provisional: true,
    },
    ...PA_DISTRICTS,
  ],
}
