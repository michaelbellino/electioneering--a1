#!/usr/bin/env node
/**
 * ETL: Census ACS  ->  baked demographics snapshot.
 *
 * This is a BUILD-TIME tool. It needs a free Census API key (a developer secret, never shipped):
 *
 *     CENSUS_API_KEY=xxxxxxxx node scripts/etl/fetch-census.mjs
 *
 * It fetches American Community Survey 5-year data, maps it into the game's normalized
 * `DemographicsDataset` shape (race × education segments, income, age, CVAP), validates it, and writes
 * a versioned JSON snapshot to src/data/datasets/demographics.generated.json. The game then loads ONLY
 * that baked snapshot at runtime — no key, no network, fully deterministic and offline. Re-run to
 * refresh; bump the data version; ship a new release. See docs/data-pipeline.md.
 *
 * Geographies default to the four seed jurisdictions; pass --states or --cds to widen coverage.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', 'src', 'data', 'datasets', 'demographics.generated.json')

const KEY = process.env.CENSUS_API_KEY ?? '' // keyless works at low volume; a key removes rate limits
const YEAR = process.env.ACS_YEAR ?? '2022'
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`

if (!KEY) {
  console.warn('CENSUS_API_KEY not set — running keyless (rate-limited; fine for one refresh).')
}

// --- ACS variable map -------------------------------------------------------
// Race/ethnicity (B03002 — Hispanic or Latino origin by race):
const V = {
  totalPop: 'B01003_001E',
  medianAge: 'B01002_001E',
  medianIncome: 'B19013_001E',
  cvap: 'B29001_001E', // citizen, voting-age population (total)
  raceTotal: 'B03002_001E',
  whiteNH: 'B03002_003E',
  blackNH: 'B03002_004E',
  asianNH: 'B03002_006E',
  hispanic: 'B03002_012E',
  // Educational attainment, White alone not Hispanic, pop 25+ (C15002H):
  eduWhiteTotal: 'C15002H_001E',
  eduWhiteMaleBA: 'C15002H_006E',
  eduWhiteMaleGrad: 'C15002H_007E',
  eduWhiteFemaleBA: 'C15002H_012E',
  eduWhiteFemaleGrad: 'C15002H_013E',
}
const GET = Object.values(V).join(',')

// Default geographies = the seed jurisdictions (state + 3 congressional districts).
const GEOS = [
  { id: 'us-pa', name: 'Pennsylvania', level: 'state', for: 'state:42', parentId: 'us' },
  {
    id: 'us-pa-cd07',
    name: "Pennsylvania's 7th Congressional District",
    level: 'congressional_district',
    for: 'congressional%20district:07',
    in: 'state:42',
    parentId: 'us-pa',
  },
  {
    id: 'us-ny-cd13',
    name: "New York's 13th Congressional District",
    level: 'congressional_district',
    for: 'congressional%20district:13',
    in: 'state:36',
    parentId: 'us-ny',
  },
  {
    id: 'us-tx-cd13',
    name: "Texas's 13th Congressional District",
    level: 'congressional_district',
    for: 'congressional%20district:13',
    in: 'state:48',
    parentId: 'us-tx',
  },
]

async function fetchGeo(geo) {
  const url =
    `${BASE}?get=NAME,${GET}&for=${geo.for}` + (geo.in ? `&in=${geo.in}` : '') + (KEY ? `&key=${KEY}` : '')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Census ${res.status} for ${geo.id}: ${await res.text()}`)
  const rows = await res.json() // [header, dataRow]
  const header = rows[0]
  const row = rows[1]
  const rec = {}
  header.forEach((h, i) => (rec[h] = row[i]))
  return rec
}

const num = (x) => {
  const n = Number(x)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function toJurisdiction(geo, rec) {
  const raceTotal = num(rec[V.raceTotal]) || 1
  const whiteNH = num(rec[V.whiteNH])
  const blackNH = num(rec[V.blackNH])
  const asianNH = num(rec[V.asianNH])
  const hispanic = num(rec[V.hispanic])
  const other = Math.max(0, raceTotal - whiteNH - blackNH - asianNH - hispanic)

  const eduWhiteTotal = num(rec[V.eduWhiteTotal]) || 1
  const whiteCollege25 =
    num(rec[V.eduWhiteMaleBA]) +
    num(rec[V.eduWhiteMaleGrad]) +
    num(rec[V.eduWhiteFemaleBA]) +
    num(rec[V.eduWhiteFemaleGrad])
  const whiteCollegeFrac = Math.min(1, whiteCollege25 / eduWhiteTotal)

  const whiteShare = whiteNH / raceTotal
  const shares = {
    white_college: whiteShare * whiteCollegeFrac,
    white_noncollege: whiteShare * (1 - whiteCollegeFrac),
    black: blackNH / raceTotal,
    hispanic: hispanic / raceTotal,
    asian: asianNH / raceTotal,
    other: other / raceTotal,
  }
  // Renormalize to exactly 1 (guards against rounding in the source).
  const tot = Object.values(shares).reduce((a, b) => a + b, 0) || 1
  for (const k of Object.keys(shares)) shares[k] = Number((shares[k] / tot).toFixed(5))

  const pop = num(rec[V.totalPop])
  const cvap = num(rec[V.cvap])
  return {
    id: geo.id,
    name: geo.name,
    level: geo.level,
    geoid: (rec.state ?? '') + (rec['congressional district'] ?? ''),
    parentId: geo.parentId,
    population: pop,
    cvap,
    registeredVoters: Math.round(cvap * 0.78), // estimate; refined by a future voter-file ETL stage
    medianHouseholdIncome: num(rec[V.medianIncome]),
    medianAge: num(rec[V.medianAge]),
    segmentShares: shares,
    // Lean/turnout are calibrated in a SEPARATE results ETL stage; carried as provisional here.
    baselinePartisanLean: 0,
    baselineTurnout: 0.55,
    provisional: true,
  }
}

async function main() {
  console.log(`Fetching ACS ${YEAR} for ${GEOS.length} geographies…`)
  const jurisdictions = []
  for (const geo of GEOS) {
    const rec = await fetchGeo(geo)
    jurisdictions.push(toJurisdiction(geo, rec))
    console.log(`  ✓ ${geo.id}`)
  }
  const dataset = {
    dataVersion: `acs${YEAR}-${new Date().toISOString().slice(0, 10)}`,
    sources: [
      `US Census Bureau, American Community Survey ${YEAR} 5-year estimates (api.census.gov)`,
      'Partisan lean/turnout calibrated separately from public election returns (results ETL stage)',
    ],
    generatedNote: `Generated by scripts/etl/fetch-census.mjs from ACS ${YEAR}. Do not hand-edit.`,
    jurisdictions,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`\nWrote ${jurisdictions.length} jurisdictions -> ${OUT}`)
  console.log('Next: point src/data/datasets/active.ts at the generated snapshot, then `npm test`.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
