# CLAUDE.md — working notes for this repo

**Stateline** is a deep US political/electoral simulation game: a pure deterministic TypeScript
simulation engine + a React UI, grounded in real Census demographics.

## Commands

- `npm test` — full Vitest suite (run this after any engine change).
- `npm run test:watch` — watch mode.
- `npm run typecheck` — strict `tsc -b` (no emit). Must stay green.
- `npm run dev` / `npm run build` — Vite UI.
- `CENSUS_API_KEY=… npm run etl:demographics` — refresh real demographics (build-time only).

## Non-negotiable engine rules (this is what makes the game testable)

1. **The engine is pure & deterministic.** Everything under `src/engine` and `src/data` must have **no
   DOM, no I/O, no network**. Same inputs → byte-identical outputs.
2. **No `Math.random()` and no `Date.now()` / `new Date()` in the engine.** All randomness goes through
   `src/engine/core/rng.ts` (seeded, serializable, forkable). All time goes through
   `src/engine/core/calendar.ts` (integer day-index, no JS `Date`). These are banned so replays and
   tests are reproducible. (Node scripts under `scripts/` may use them — they're build-time.)
3. **State is a plain serializable object.** No class instances with hidden state in `GameState`, no
   `Map`/`Set` in serialized state (use `Record`). Save/load is JSON round-trip.
4. **One mutation channel.** State changes only via actions through the root reducer (when wired). The
   UI dispatches serializable actions; it never mutates engine state.
5. **The effects ledger is the single bridge.** Campaign and governing effects both lower into
   `src/engine/core/ledger.ts` `ScheduledEffect`s; the electorate/economy are pure *consumers*.

## Layout

```
src/engine/core/       determinism spine: rng, calendar, events, ledger, primitives
src/engine/electorate/ voter model: build (calibration), evaluate (vote/turnout), polling
src/engine/electoral/  offices/seats, allocators (FPTP…), election resolution
src/data/              real-data layer: schema (Zod), voterModel, datasets/, loader, (ETL output)
src/ui/                React UI (pure render of engine state)
scripts/etl/           build-time ETL (Census → baked snapshots)
docs/                  architecture, data-pipeline, model-methodology, platform-and-distribution
```

## Conventions

- Money is **integer cents** (`Cents`), never floats.
- Issue/lean direction everywhere: **+1 = progressive/Democratic pole, −1 = conservative/Republican**.
- Content (issues, segments, campaign actions, bills) is **data-driven** for moddability — add data,
  not hardcoded logic.
- TDD: write the test (invariant / comparative static / determinism), then the code. Calibrated models
  carry a *verifiable* test that reproduces a known real value within tolerance.

## Branch

Active development branch: `claude/lucid-wright-34ic6a`. Don't push elsewhere without asking.
