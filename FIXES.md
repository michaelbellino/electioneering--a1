# Fixes — tracker

Tracks fixes derived from [`ANALYSIS.md`](ANALYSIS.md). Scope note: the runnable game
(**Stateline**) was materialized from `electiongames.zip` into `stateline/` so fixes are real,
reviewable diffs. The zip is kept as the untouched original snapshot. Campaign Trail is not
runnable, so its issues are tracked here rather than guessed at.

**Verification baseline:** `npm run typecheck` clean · `npm test` = **91/91 passing**, before and
after every change below.

---

## ✅ Done (cheap + high-value, verified green)

### 1. The candidate creator now explains what its options do
*The original complaint — "the background options don't tell you what they do."*
`stateline/src/ui/screens/CandidateCreator.tsx` (+ `components/Slider.tsx`, `styles/global.css`)

- Added a one-line **effect hint under every attribute slider** (Charisma → biggest quality driver +
  event punch; Competence → quality; Integrity → minor; Fundraising → yields + weekly income).
- Added a **live "Candidate Quality" (valence) readout** that shows the exact 0–100 number the
  electorate will use, recomputed as you move the sliders.
- Added a note that **party loyalty outweighs quality** and that **you start with low name
  recognition** (nobody votes for someone they've never heard of).
- Added a **per-party hint** under the party selector, including that Independent has no base and is
  hard mode, and that the scripted PA-07 opponent is a Republican.
- Platform intro now says voters reward proximity and **each group weighs issues differently**.

### 2. Single source of truth for the quality formula
`stateline/src/engine/campaign/profile.ts`

- Extracted a pure `valenceFrom(attributes, scandalLoad?)` helper; `valenceOf(candidate)` now
  delegates to it. The creator UI imports the same function, so the preview can never drift from the
  engine. Behavior is identical (tests unchanged, still green).

### 3. Candidate Quality is visible during play, not just at creation
`stateline/src/ui/selectors.ts`, `stateline/src/ui/screens/CampaignDashboard.tsx`

- `standings()` now exposes `valence`; the dashboard "The Race" panel shows a third **Quality**
  meter next to Name-rec and Favorability, so the attributes you picked stay legible all game.

### 4. Playable build
- Produced a self-contained, offline single-file build: **`stateline-play.html`** (repo root) and a
  hosted Artifact link. No external requests (all JS/CSS inlined; fonts are system stacks).

---

## ⏳ Deferred — needs a design decision (not "cheap")

### D1. The party/opponent footgun
`gameStore.startGame` overlays your candidate onto the scenario but leaves the opponent hardcoded as
Republican "Dale Whitaker". So **picking R yields two Republicans**, and **picking Independent** zeroes
the dominant partisan term. Options: (a) derive the opponent's party/name from the player's choice;
(b) give Independent a real third-party model; (c) restrict the party control to what the scenario
supports. Each changes balance and the scenario contract — needs a call. *(Mitigated for now by the
new per-party hints so the choice is at least informed.)*

### D2. GOTV does nothing for an Independent
`deriveTurnoutBoostMap` early-outs when `partyDir === 0`, so canvassing is a dead action for
Independents. Fixing it means defining "who an Independent's favorable groups are" (e.g. groups whose
lean magnitude is small, or by issue proximity). Model decision.

### D3. GOTV is invisible in the polls
`conductPollRecord` evaluates without the turnout boost while the real result applies it, so
canvassing can win the election without ever moving your poll line. Either fold turnout into the
poll estimate or surface a separate "modeled turnout edge" indicator. Design/UX call.

### D4. "Diminishing returns" claimed but not implemented
`roadmap.md` lists diminishing returns as a done Phase-1 feature, but `pipeline.ts` applies none and
positive TV ads have a 0-day cooldown, so ad spam stacks linearly. Either implement per-action buy
decay (changes balance + may shift the e2e "out-campaigning wins" test) or correct the roadmap. Left
for a balance pass.

---

## 📋 Known / intentional — documented, deliberately not touched

### K1. Inert Phase-2/3 scaffolding
`scandalLoad`, `strategy.tone/focusIssue`, the `persuasion` effect channel, `incumbent`,
`segmentWeights`, and the third (`ai`) RNG stream are written but read by nothing. They're forward
hooks for roadmap Phases 2–3 (governing, opinion dynamics, input NLP), not bugs. Wiring them up is
feature work, not a fix; removing them would delete roadmap scaffolding. Leaving as-is.

### K2. Provisional "real" data
`demographics.seed.ts` is `provisional: true` placeholder until `npm run etl:demographics` runs with
a Census key. The deep docs say so; only the top-level README/UI imply the shipped data is real ACS.
Cheap honesty fix available (label it in-app) — deferred with the other UI copy work.

### K3. Unreachable content
NY-13 and TX-13 are fully authored + calibrated but only PA-07 is selectable. Turning them into
selectable scenarios is easy content work, tracked as an enhancement rather than a bug.

### K4. Unused helpers
`primitives.ts` exports `sigmoid`/`softmax` that nothing calls. Harmless; a lint/cleanup nit.

---

## 🚫 Campaign Trail — data issues (blocked: no engine to verify against)

Campaign Trail ships no `engine.js`/`ui.js`/`main.js`/`index.html`, so it doesn't run and any data
"fix" can't be verified. Tracked, not applied:

- **CT1.** Dual EV fields per region (`baseElectoralVotes` sums 328, `electoralVotes` sums 538) — one
  should be dropped or clearly marked as the live field.
- **CT2.** The regression-to-mean mechanic reads a `regionBaseline` that **isn't present** in any
  region row (rows only have `initialLean`). The core upkeep math has no baseline to read.
- **CT3.** Field names diverge from the documented state model (`initialLean` vs `lean`/`baseLean`).
- **CT4.** Balance prose says "~235 EV start / ~5 safe (lean ≥ 40) regions"; the actual board is
  **295 EV** with **zero** lean ≥ 40 regions, breaking the tutorial and `win_early_clinch` copy.
- **CT5.** Per-region `volatility` (0.15–0.2) vs global `baseVolatility` (2.5) never reconciled.
- **CT6.** No engine/UI/HTML at all — the largest gap; the whole simulation exists only as prose in
  `data.js`.
