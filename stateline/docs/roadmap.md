# Stateline — roadmap, editions & modding plan

This is the step-by-step plan from the current foundation to a shippable, moddable game, plus the
"editions" we're aiming at. **Modding and expansion are cross-cutting constraints**: every phase below
must leave content as data, behind schemas, so the same path that ships first-party content also lets
modders ship theirs.

## Cross-cutting principles (apply to every phase)

1. **Content is data, logic is generic.** Issues, segments, campaign actions, bills, the political-
   concept dictionary, offices, scenarios — all authored as schema-validated data. The engine never
   hardcodes a specific issue or action; it interprets data. (This is why a modder can add an action or
   a state without touching engine code.)
2. **Everything moddable is versioned + Zod-validated.** Same pattern as Subway Builder: a content pack
   is a `manifest.json` + validated data (+ optional JS/TS script). Bad data fails loudly at load.
3. **The engine stays pure & deterministic.** Mods extend *data and content*, not the determinism
   contract. Scripted mods run against a stable, documented engine API.
4. **One moddable unit = a "pack."** A pack can be a content pack (issues/actions/bills), a region pack
   (a state/district + its baked demographics), or a scenario pack (a starting situation). First-party
   content ships as packs too.
5. **Document the modding API as we build**, not after.

## Phased build plan

### Phase 0 — Foundation ✅ (done, committed)
Deterministic engine core (RNG, calendar, events, ledger), real-data layer (schema, calibrated voter
model, baked snapshot, Census ETL), electorate model (calibrated, verifiable), electoral resolution
(FPTP). 66 tests.

### Phase 1 — First Playable Slice (Web) ✅ (done)
Goal: click through a whole race in the browser.
1. **Campaign engine** — candidate creation; data-driven actions (rally, ad, speech, fundraise) with
   cash/action-point costs, cooldowns, diminishing returns; integer-cents finance; a light staff/office
   tycoon layer; actions emit effects into the ledger.
2. **Engine spine** — assemble `GameState`; root reducer routing namespaced actions; `createGame`,
   `dispatch`, `tick`, `serialize`/`deserialize`, `subscribe`. Schedule election day as an event.
3. **End-to-end determinism test** — create candidate → pick the PA‑07 race → run actions → advance
   weeks → polls move → election night → result; serialize byte-identical across runs and across a
   save/load/continue.
4. **Web UI** — main menu → candidate creator → campaign dashboard (actions, live polling chart, turn
   controls, finance) → election night. Pure render of engine state; dispatch-only.

**Modding hook this phase:** campaign actions are already a content pack (`src/data/campaign/…`); the
candidate platform UI is generated from the issues data.

### Phase 2 — Governing & Legislature
Win an office → a customizable bill/legislature engine: data-driven bills (provisions with sim effects +
fiscal notes), a configurable legislative process state machine (committee → floor → chambers → exec →
veto/override), AI legislators with whip counts, policy effects feeding back through the ledger.
**Modding hook:** bills, the process state machine, and policy effects are all data.

### Phase 3 — Input Understanding (lightweight LLM / Scribblenauts-style)
A pluggable adapter turning free-text speeches/bills into structured intent (issues, stance, tone,
targeted segments) via a curated, moddable **political-concept dictionary** + a lightweight local matcher
(deterministic), with an optional LLM backend for fuzzier parsing. Engine consumes only structured
output. **Modding hook:** the concept dictionary is the headline moddable asset.

### Phase 4 — Nationwide depth
All 50 states + DC; full office taxonomy (federal/state/local); primaries (open/closed/jungle), runoffs,
special/recall, ballot initiatives; staggered terms; Electoral College, RCV, multi-member allocators.
Region packs baked for every state from the ETL. **Modding hook:** any jurisdiction is a region pack.

### Phase 5 — Maps & polish
MapLibre + Protomaps/MVT vector tiles with Census TIGER geometry; the Democracy-style causal-graph
visualization of issues/policies/voter groups; dashboards, election-night map, accessibility pass.

### Phase 6 — Modding SDK & packaging
Public, versioned modding docs; a pack authoring/validation CLI; Steam Workshop integration; desktop
packaging via **Tauri** → Steam (Win/macOS/Linux) + direct download.

## Editions (what we ship, to whom)

| Edition | Audience | Contents | Distribution |
|---|---|---|---|
| **Web (Free)** | everyone, demos | Phase 1–2 slice, a few real regions, in-browser | static web host |
| **Desktop (Steam)** | players | full game (Phases 1–5), all regions, saves, mods | Tauri → Steam + direct |
| **Modding SDK / "Studio"** | creators | pack schemas, authoring CLI, docs, sample packs | repo / docs site |
| **Sandbox / Education** | classrooms | scenario packs, transparent model, no microtransactions | web + desktop |

Editions are **the same engine + different content/packaging**, not forks — guaranteed by the
content-is-data principle.

## Definition of done for Phase 1 — ✅ all met
- [x] Campaign engine with 6 data-driven actions + finance + staff, fully unit-tested.
- [x] Engine spine with serialize/deserialize and a passing end-to-end determinism test.
- [x] Playable web UI: candidate → campaign → election night, against the real PA‑07 electorate.
- [x] Green: `npm test` (91 tests) + `npm run typecheck` + production build. Pushed (PR #1).
