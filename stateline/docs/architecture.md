# Architecture

Stateline separates a **pure simulation engine** from a **presentation layer**. The engine is the game;
the UI is a window onto it. This split is what makes deep simulation testable and lets us re-target the
front-end later (web today; Tauri/Electron desktop, or another engine, tomorrow) without rewriting the
simulation.

```
            ┌─────────────────────────────────────────────┐
  dispatch  │                  React UI                    │
  actions ─▶│  pure render of GameState · no game logic    │
            └───────────────▲──────────────┬───────────────┘
                            │ GameState     │ Action
            ┌───────────────┴──────────────▼───────────────┐
            │              SIMULATION ENGINE                │
            │  pure · deterministic · serializable · no DOM │
            │                                               │
            │  core      rng · calendar · events · ledger   │
            │  data      real demographics + voter model    │
            │  electorate build → evaluate → polling        │
            │  electoral  offices/seats → allocate → result │
            │  campaign   (next) actions → effects ledger   │
            │  governing  (roadmap) bills → effects ledger  │
            └───────────────────────────────────────────────┘
```

## The determinism contract

The single most important property: **`createGame(seed)` + a fixed action/tick log replays to a
byte-identical state**, on any machine. It buys us reproducible saves, replays, debuggable simulations,
and tests that assert exact behavior. It requires:

- **Seeded, serializable, forkable RNG** (`core/rng.ts`). The whole PRNG state is `{ s: number }`.
  Subsystems draw from *forked* streams (`rng.fork('poll:'+id)`) so polling can't perturb the AI, etc.
- **Integer-day calendar** (`core/calendar.ts`) — no `Date`, no timezones. A `tick` advances
  `daysPerTick` days.
- **Plain serializable state** — `Record`s, not `Map`/`Set`; no hidden class state.

## The effects ledger — one bridge for everything

A central reconciliation: campaigns and governing both produce "a lagged, attributed change to the
simulation." Instead of two systems, both lower into **one** list of `ScheduledEffect`s
(`core/ledger.ts`) with shared ramp → plateau → decay → sunset math. The electorate and (future)
economy are **pure consumers** — they read the active magnitude of effects targeting them and are never
written to directly. This keeps one source of truth and one lag implementation.

## Electorate model (the heart)

Per jurisdiction, an electorate is built **once** from real demographic composition × the calibrated
voter model, plus a fitted `calibrationOffset` so the modelled baseline reproduces the area's real lean
(see `docs/model-methodology.md`). Then `evaluateElectorate` is a **pure, RNG-free** function: spatial
issue voting + partisanship + valence + favorability → an awareness-gated softmax vote choice, with
turnout scaled to the calibrated baseline. Randomness (polling noise, election-night tie-breaks) is
layered on top via forked RNG so previews stay stable.

## Data-driven & moddable

Issues, demographic segments, the voter model, campaign actions, and (later) bills are **data**, not
hardcoded logic. Adding content is adding data + (optionally) a schema-validated content pack. This is
the same philosophy that makes *Subway Builder* moddable (see `docs/platform-and-distribution.md`).

## Module dependency direction

`core/primitives` (no deps) ← everything. `data/schema` ← `data/voterModel`, datasets, loader.
`engine/electorate` ← `data`, `core`. `engine/electoral` ← `engine/electorate`, `core`. The UI imports
the engine; the engine never imports the UI (enforced by convention / future lint boundary).
