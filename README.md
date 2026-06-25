# Campaign Trail: Road to 270

A turn-based **election-campaign strategy game** — and a **satire of money-in-politics**:
a bright, friendly campaign-tech "brand" (*DEMOS Strategic Solutions — Democracy,
Optimized.™*) whose civic surface hides a cold optimization machine that treats voters
as nodes and democracy as a product. Run a national campaign across **18 regions** worth
**538 electoral votes** over **12 weeks**, racing to clinch **270** against a reactive
rival — while the UI quietly corrupts as you work the money.

**Bright by default, with an opt-in dark theme.** A distinct identity built on
self-hosted open-source type (Bricolage Grotesque · Public Sans · Space Mono) and custom
SVG glyphs. The game is hand-written vanilla JavaScript with a pure, deterministic engine
and a thin SVG render layer. It runs **with no build step straight from `file://`** and
ships as a **packaged desktop app** (Windows / macOS / Linux) via Electron.

> The deeper "full tycoon sim" redesign (parameterized fundraising/rallies, a time
> economy, donor/dark-money networks, staff & ops, media & opposition) is specced in
> [`docs/REDESIGN.md`](docs/REDESIGN.md) and shipping in phases. Phase 1 (this identity)
> is in.

---

## Play

### In a browser (no build)
Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000      # then visit http://localhost:8000
```

Pick a candidate and difficulty, then each week spend your **5 Action Points**
(they do **not** bank) and **Funds** on region- or nation-targeted actions, react
to events, and end the week. Win by holding 270+ on election day (or clinching
early / forcing an opponent collapse). Lose by missing 270, going bankrupt, or
letting your scandal hit 80.

### As a desktop app (development)

```bash
npm install
npm start            # launches the Electron shell around the same assets
```

---

## How it plays

- **Non-linear sandbox.** There's no scripted path. Each week you choose *which*
  regions to contest and *how*: TV/Social Ad Blitz and Attack Ads (air war),
  Build Field Office / Recruit / Volunteer Canvass (ground game, sticky and
  snowballs late), Rally / Debate (volatile momentum + media buzz), Major
  Fundraiser (the economic engine), Opposition Research (high-variance attacks),
  Damage Control, Counter-Messaging, and a Polling Consultant for intel.
- **Polls have physics.** Momentum decays, region leans regress toward a
  structural baseline, volatility keeps tossups alive, and scandal drags you
  down — so coasting is a slow loss.
- **A reactive opponent.** The AI scores the map, concentrates fire on the most
  valuable tossups and your thin leads, counterpunches, exploits your scandal,
  and self-preserves — scaled by Easy / Normal / Hard.
- **Three candidates**, each with a distinct lane: a charismatic outsider
  (momentum), a seasoned insider (air war + war chest), and a grassroots
  organizer (ground game).

---

## Build installers

Installers are produced by [`electron-builder`](https://www.electron.build/).
On each platform's native runner you get that platform's installer:

```bash
npm run dist:linux   # AppImage + .deb + .tar.gz
npm run dist:win     # NSIS .exe installer + portable .exe
npm run dist:mac     # .dmg + .zip
npm run pack         # quick unpacked binary (dist/<platform>-unpacked/)
```

Cross-platform installers are best produced on native runners — see
`.github/workflows/release.yml`, which builds and tests on Ubuntu, Windows, and
macOS and attaches the installers to a GitHub Release when you push a `vX.Y.Z`
tag. (A Windows `.exe` / macOS `.dmg` cannot be fully built or signed from
Linux.)

The app icon is generated dependency-free from the brand star:

```bash
npm run icon         # writes build/icon.png
```

### Distribution plan — an install for every edition

This is designed up front so shipping any edition is a one-command / one-tag
operation; nothing in the game code needs to change to produce installers.

| Edition | Artifact(s) | How it's produced | Status |
|---|---|---|---|
| **Linux** | AppImage, `.deb`, `.tar.gz`, unpacked binary | `npm run dist:linux` (electron-builder, native) | **built & verified locally** |
| **Windows** | NSIS `.exe` installer + portable `.exe` | `npm run dist:win` on a Windows runner (CI) | portable `.exe` built locally; branded installer via CI |
| **macOS** | `.dmg` + `.zip` | `npm run dist:mac` on a macOS runner (CI) | via CI (cannot build/sign from Linux) |

**Why CI for Windows/macOS:** a Windows `.exe` installer and a macOS `.dmg`
can only be fully built (and code-signed) on their own OS. The committed
GitHub Actions workflow (`.github/workflows/release.yml`) does exactly this:

1. Push a version tag, e.g. `git tag v0.1.0 && git push origin v0.1.0`.
2. CI runs the headless test suite, then builds the installers on **native**
   Ubuntu, Windows, and macOS runners in parallel.
3. The installers for every edition are uploaded as build artifacts and
   attached to an auto-generated **GitHub Release** to download.

A manual **Run workflow** (workflow_dispatch) builds all editions as artifacts
without cutting a release. Code-signing certificates (optional) slot in as CI
secrets later without code changes.

---

## Test / TDD

The engine is pure and headless, so you develop it test-first. The unit suite
uses **Node's built-in test runner** (`node --test`) — no framework, no build,
no dependencies — with a **watch mode** for a tight red → green → refactor loop.

```bash
npm run test:watch   # TDD loop: re-runs the unit suite on every save
npm test             # unit suite once (test/*.test.js)
npm run test:sim     # balance + win/fail reachability sweeps (test/sim.js)
npm run test:dom     # jsdom: drives a full game through the rendered UI
npm run test:layout  # real Chromium: start-screen layout guard (self-skips w/o a browser)
npm run test:all     # unit + sim + dom + layout
```

**TDD loop:** start `npm run test:watch`, add a failing `it(...)` in
`test/engine.test.js` (or a new `test/*.test.js`), watch it go red, implement in
`src/engine.js`, watch it go green — the watcher re-runs when either the test or
the engine source changes.

Three layers:
- **Unit** (`test/engine.test.js`, `util.test.js`, `data.test.js`) — 45 fast,
  isolated tests of the public API, every action formula, the win/fail rules,
  events, undo, determinism + save/load, and the spec invariants.
- **Simulation** (`test/sim.js`) — drives full games through the public API (no
  UI) and asserts a smart strategy wins on Normal, that idle and over-leveraged
  play reach **every** fail condition (electoral loss, bankruptcy, scandal
  collapse), that difficulty is monotonic, that the ground lane snowballs *late*
  (no week-6 runaway), and that the engine is deterministic per seed.
- **Rendered UI** (`test/dom-smoke.js`) — loads `index.html` in jsdom and plays
  a full game through the real UI, asserting the screens render with no runtime
  error.
- **Browser layout** (`test/layout.e2e.mjs`) — loads the real page in headless
  Chromium (Playwright) and asserts the start screen is usable across viewports
  (candidate cards lay out as a row, the primary CTA stays in view, no horizontal
  overflow, single-column on mobile). jsdom can't do CSS layout, so this guards
  layout regressions. It **self-skips** when no browser is available, so the
  default CI stays green; provide one with `npx playwright install chromium`.

---

## Repository layout

This repo is **Campaign Trail** at its root. Supporting material lives alongside:

```
src/ assets/ desktop/ test/ ...   the game (vanilla JS, no build) + Electron shell
.claude/skills/ui-ux-pro-max/     UI/UX design-intelligence skill (used during design)
claude-code-game-studios/         vendored studio agents/skills/templates (dev tooling)
reference/stateline/              a separate TypeScript/React take on an election game,
                                  kept for reference (not part of the build)
```

---

## Architecture

```
index.html               shell; loads CSS + scripts in dependency order
assets/css/styles.css     design system (the war-room class contract)
assets/css/app.css        token-only composition layer for the app views
src/rng.js                seeded deterministic RNG          (Campaign.RNG)
src/util.js               clamp/format/lean helpers          (Campaign.Util)
src/charts.js             hand-rolled SVG charts             (Campaign.Charts)
src/map.js                SVG cartogram electoral map        (Campaign.MapView)
src/data.js               the game spec + content            (Campaign.Data)
src/engine.js             pure game logic, zero DOM          (Campaign.Engine)
src/ui.js                 rendering + event handlers         (Campaign.UI)
src/main.js               bootstrap, screen flow, save/load
desktop/main.js           Electron main process (desktop shell)
desktop/preload.js        context-isolated preload
test/                     headless engine + DOM test harnesses
tools/gen-icon.js         dependency-free PNG icon generator
docs/ARCHITECTURE.md      engine contract + turn loop + win/fail rules
docs/DESIGN.md            visual system + pre-delivery checklist
```

**Strict engine/UI separation.** `src/engine.js` is the entire backend — state,
rules, simulation, opponent AI, and win/fail evaluation — with **no DOM access**.
The UI reads engine state and calls engine methods; you can play a full game
headlessly. All randomness flows through the seeded RNG, so a
`(seed, candidate, difficulty, action-sequence)` reproduces an identical game and
`save`/`load` restores the exact RNG stream position.

Scripts are classic `<script>` tags (no ES modules) loaded in dependency order
`rng → util → charts → map → data → engine → ui → main`, so the game runs from
`file://` with no bundler. The Electron build wraps these exact assets unchanged.

The `claude-code-game-studios/` directory is vendored game-development studio
tooling (kept nested so its hooks don't override this repo's session config).

## License

MIT.
