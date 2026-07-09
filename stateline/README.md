# Stateline

A deep, data-grounded **US political & electoral simulation game** — in the spirit of the *Democracy*
series and *The Political Process*, but built on **real Census demographics** the way *Subway Builder*
is built on real transit/geographic data.

You create a candidate, pick any election across the country (federal, state, local), and run a full
campaign — rallies, advertising, speeches, fundraising, staff and a semi-tycoon campaign operation —
or start as an elected official and govern through a customizable bill/legislature process. Everything
sits on top of a thorough, deterministic simulation.

## What's real vs. simulated

- **Real data = the terrain.** Census demographics (population, age, race, income, education) per real
  jurisdiction, plus *models* of how those demographics drive voter intention, partisan lean, issue
  salience, and policy preferences — calibrated to recent real results.
- **Everything else = the game.** Campaigns, fundraising, ads, rallies, bills, the legislative process
  are simulated mechanics, not live data feeds. (No live campaign-finance or bill dashboards — that
  would be a dashboard, not a game.)

## Architecture in one breath

A **pure, deterministic, fully-tested TypeScript simulation engine** (`src/engine`, zero DOM) with a
**React UI** (`src/ui`) that is a pure render of engine state. The engine is engine-agnostic: the same
core can later drive a desktop (Tauri/Electron) or other front-end. See
[`docs/architecture.md`](docs/architecture.md).

## Status

**First playable slice is complete** — create a candidate, run a real PA-07 campaign, watch the
polls move, and play out election night. Built end to end and tested (91 tests).

| Layer | Module | Status |
|---|---|---|
| Determinism core | `engine/core` — RNG, calendar, event queue, effects ledger | ✅ tested |
| Real-data layer | `data` — Zod schema, calibrated voter model, baked snapshot, ETL, loader | ✅ tested |
| Electorate model | `engine/electorate` — demographics→vote, calibrated, polling | ✅ tested |
| Electoral resolution | `engine/electoral` — offices/seats, FPTP allocator, election night | ✅ tested |
| Campaign engine | `engine/campaign` — candidate, data-driven actions, fundraising, staff | ✅ tested |
| Web UI | `ui` — candidate creator → campaign dashboard → election night | ✅ tested |
| Legislature/governing | bills, process, AI legislators | ⏳ roadmap (Phase 2) |
| Input understanding | lightweight NLP for speeches/bills (Scribblenauts-style) | ⏳ roadmap (Phase 3) |

Play it: `npm install && npm run dev`. See [`docs/roadmap.md`](docs/roadmap.md) for the phased plan
and editions.

## Develop

```bash
npm install
npm test           # run the full deterministic test suite (Vitest)
npm run typecheck  # strict TypeScript build
npm run dev        # Vite dev server (UI)
npm run build      # production build
```

## Real-data refresh (reproducible & distributable)

Demographics are **baked into versioned snapshots** committed to the repo, so the game is deterministic
and offline. To refresh them from the live Census API (a free, build-time developer key — never shipped
to players):

```bash
CENSUS_API_KEY=xxxx npm run etl:demographics
```

See [`docs/data-pipeline.md`](docs/data-pipeline.md) for the full reproducible pipeline.
