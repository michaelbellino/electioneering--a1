# Campaign Trail: Road to 270

A turn-based **election-campaign strategy game**, styled as a dark "campaign
war room" dashboard. Run a national campaign across **18 regions** worth **538
electoral votes** over **12 weeks**, freely spending **Action Points** and a
**Funds** war chest on a non-linear mix of air-war, ground-game, and momentum
plays — reacting to dynamic events and a reactive opponent AI — racing to clinch
**270**.

The game is hand-written vanilla JavaScript with a pure, deterministic engine
and a thin SVG render layer. It runs **with no build step straight from
`file://`** for development and testing, and ships as a **packaged desktop app**
(Windows / macOS / Linux) via Electron.

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

---

## Test

```bash
npm test             # engine simulation: balance + all win/fail reachability
npm run test:dom     # jsdom: drives a full game through the rendered UI
npm run test:all     # both
```

`test/sim.js` drives full games through the public engine API (no UI) and
asserts that a smart strategy wins on Normal, that idle and over-leveraged play
reach **every** fail condition (electoral loss, bankruptcy, scandal collapse),
that difficulty is monotonic, and that the engine is deterministic per seed.
`test/dom-smoke.js` loads `index.html` in jsdom and plays a full game through the
real UI, asserting the screens render with no runtime error.

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
