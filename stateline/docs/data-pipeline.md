# Real-data pipeline — reproducible & distributable

The game is grounded in **real Census demographics**, but a shipped game must be **deterministic and
offline** — players should not need an API key, a network connection, or data-engineering skills, and
two players on the same data version must get identical results. We achieve this with the same pattern
*Subway Builder* uses: **bake real data into versioned snapshots at build time; load only the snapshots
at runtime.**

```
  BUILD TIME (developers, with a key)        RUNTIME (players, no key, offline)
  ┌─────────────────────────────┐            ┌──────────────────────────────┐
  │ Census ACS API + TIGER geo  │            │ baked snapshot (committed)   │
  │            │                │            │   src/data/datasets/*.json   │
  │            ▼                │   commit   │            │                 │
  │ scripts/etl/fetch-census.mjs│ ─────────▶ │            ▼                 │
  │   fetch → map → Zod-validate│            │ loader.ts (Zod-validated)    │
  │   → versioned JSON snapshot │            │            │                 │
  └─────────────────────────────┘            │            ▼                 │
                                             │ deterministic simulation     │
                                             └──────────────────────────────┘
```

## Why this design

- **Determinism:** a live API returns different data over time; a baked snapshot does not. The data
  version is pinned in source control, so a save/replay is reproducible forever.
- **Distributable:** the Census key is a **developer build secret**, never shipped. Players get JSON.
- **Offline:** no runtime network dependency.
- **Refreshable:** re-run the ETL to produce a new snapshot, bump the data version, ship a new release.
- **Moddable:** the snapshot is just schema-validated JSON; a modder can author a new region the same
  way the ETL does (see `docs/platform-and-distribution.md`).

## How to refresh the data

1. Get a free Census API key: <https://api.census.gov/data/key_signup.html> (instant, email).
2. Provide it as an environment variable (never commit it):
   ```bash
   export CENSUS_API_KEY=xxxxxxxxxxxxxxxx
   npm run etl:demographics
   ```
   This fetches ACS 5-year data for the configured geographies, maps it into the normalized
   `DemographicsDataset` shape (race × education segments, income, age, CVAP), validates it, and writes
   `src/data/datasets/demographics.generated.json`.
3. Point the active dataset at the generated file in `src/data/datasets/active.ts`, then `npm test`.
   Keeping this switch explicit means the data version a build ships with is always visible in git.

## What the ETL maps (ACS variables)

| Field | ACS source |
|---|---|
| population | `B01003_001E` |
| median age | `B01002_001E` |
| median household income | `B19013_001E` |
| CVAP (citizen voting-age pop) | `B29001_001E` |
| race/ethnicity | `B03002` (White NH, Black NH, Asian NH, Hispanic, other) |
| white college vs. non-college | `C15002H` (educational attainment, White NH) |

## What is NOT fetched live

Partisan lean and turnout are **calibration targets** derived from recent real election returns, used
only to fit the voter model (see `docs/model-methodology.md`). They are baked too — never streamed as a
live "data feed." Campaign finance, bills, and officeholder rosters are **simulated game mechanics**,
not real data.

## Current state

The committed snapshot is `src/data/datasets/demographics.seed.ts` — real GEOIDs and the exact ETL
output shape, with **provisional** figures (`provisional: true`) until the first keyed ETL run replaces
them with exact ACS values. The four seed jurisdictions (PA statewide, PA-07, NY-13, TX-13) span a
safe-D / tossup / safe-R range for model testing.
