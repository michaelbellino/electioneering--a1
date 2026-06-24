# Campaign Trail — Architecture

A turn-based, non-linear **election-campaign strategy sandbox**. You run a national
campaign across ~18 regions over a fixed number of weeks (turns), freely spending
**Action Points** and **Funds** on actions targeted at regions or the nation, reacting
to **dynamic events**, while an **opponent AI** campaigns against you — racing to an
electoral-vote majority on election day.

## Design principles

1. **Engine / UI separation.** `src/engine.js` is pure game logic with **no DOM access**.
   It is the "backend": it owns all state, rules, the simulation model, the opponent AI,
   and win/fail evaluation. The UI (`src/ui.js`, `src/main.js`) is a thin renderer that
   reads engine state and calls engine methods. You can play a full game with zero UI.
2. **Deterministic & testable.** All randomness flows through `src/rng.js` (seeded).
   A `(seed, candidate, difficulty, sequence-of-actions)` reproduces an identical game,
   so headless Node simulations in `test/` can prove win **and** fail are reachable.
3. **No build step, runs from `file://`.** Plain HTML/CSS/JS. Data ships as JS modules
   (not fetched JSON) and scripts are classic (not ES modules) so the game runs by simply
   opening `index.html` — the spiritual successor to a Flash game. (It also serves fine
   over `python3 -m http.server`.)
4. **Self-contained.** No CDN/runtime dependencies are required. Google Fonts load if
   online but degrade gracefully to system fonts. Charts and the electoral map are
   hand-rolled SVG.

## File layout

```
index.html              # shell; loads CSS + scripts in dependency order
assets/css/styles.css    # design system (dark "war room" dashboard) — token-driven
src/rng.js               # seeded deterministic RNG          (Campaign.RNG)
src/util.js              # clamp/lerp/format/lean helpers      (Campaign.Util)
src/charts.js            # SVG line/bar/spark/gauge/donut      (Campaign.Charts)
src/map.js               # SVG cartogram electoral map         (Campaign.MapView)
src/data.js              # generated content (design+regions+candidates+events)
src/engine.js            # pure game logic                     (Campaign.Engine)
src/ui.js                # rendering + event handlers          (Campaign.UI)
src/main.js              # bootstrap, screen flow
test/sim.js              # headless playthrough harness (Node)
design-system/…          # persisted UI/UX-Pro design system (source of truth for visuals)
docs/ARCHITECTURE.md     # this file
docs/DESIGN.md           # visual system + pre-delivery checklist
```

## Global namespace contract

Every module is UMD: in the browser it attaches to `window.Campaign.<Name>`; under Node
it is `module.exports`. Browser load order (in `index.html`):
`rng → util → charts → map → data → engine → ui → main`.

## Engine state model (canonical)

```
GameState {
  seed, turn, maxTurns, status: 'playing'|'won'|'lost',
  difficulty: 'easy'|'normal'|'hard',
  candidateId,
  resources:   { funds, actionPoints, volunteers },
  national:    { momentum, nationalApproval, scandalLevel, mediaBuzz },   // 0..100 (momentum -100..100)
  opponent:    { momentum, scandalLevel, funds, strategyNote },
  regions:     [ { id, name, abbreviation, electoralVotes, lean,          // lean -100..+100 (+ = player)
                   baseLean, volatility, mediaCostMultiplier, population } ],
  pendingEvent, // event awaiting a player choice this turn, or null
  history:     [ { turn, playerSupport, oppSupport, momentum, playerEV, oppEV } ], // for charts
  log:         [ { turn, kind:'good'|'bad'|'neutral', text } ],
  endReason,   // populated when status != 'playing'
}
```

The **channels** events/actions manipulate are fixed: `funds`, `momentum`,
`nationalApproval`, `scandalLevel`, `mediaBuzz`, `volunteers`, `actionPoints`,
`regionLean` (with a selector: all/strongest/weakest/random/mostVotes), `opponentMomentum`,
`opponentScandal`.

## Engine public API

```
Campaign.Engine.create({ seed?, candidateId, difficulty }) -> game
game.getState()                       // immutable-ish snapshot for the UI
game.availableActions()               // [{id,name,desc,costFunds,costAP,targeting,affordable,reason}]
game.canAfford(actionId)              // bool
game.doAction(actionId, targetRegionId?) -> { ok, result|error }   // spends AP/funds, applies effects
game.undoLastAction()                 // within the current turn only (sandbox feel)
game.hasPendingEvent() / game.getPendingEvent()
game.resolveEvent(choiceId) -> { applied effects }
game.endTurn() -> { events fired, opponent moves, model update, endConditions }
game.tally() -> { playerEV, oppEV, tossupEV, votesToWin }
game.checkEndConditions() -> null | { status:'won'|'lost', reason, condition }
game.save() / Campaign.Engine.load(savedString)   // localStorage JSON
```

### Turn loop (one week)

1. **Plan phase** — player spends Action Points / Funds on actions (region- or nation-targeted),
   may `undoLastAction`, no fixed order. This is the sandbox.
2. **Resolve phase** (`endTurn`): apply fundraising yield; opponent AI allocates its budget;
   run the polling/electoral model (ad/ground/momentum effects, decay, regression-to-mean,
   seeded volatility); maybe fire a weighted dynamic event (player chooses) ; update region
   leans; push a `history` sample.
3. **Evaluate** — `checkEndConditions`. If election day (turn == maxTurns) or a fail trigger
   fires, set `status` and `endReason`.

## Win / Fail conditions (continuously + on election day)

- **WIN** — on election day, player's electoral votes ≥ `votesToWin` (strict majority).
- **FAIL — defeat:** on election day, player EV < `votesToWin`.
- **FAIL — bankruptcy:** `funds` falls below `bankruptcyThreshold` before election day.
- **FAIL — scandal collapse:** `scandalLevel` reaches `scandalLossThreshold`.

(Exact thresholds/numbers come from the synthesized design in `src/data.js`.)

## Why this is a sandbox, not a linear sequence

There is no scripted path. Each week the player chooses *which* regions to contest and
*how* (air war via ads, ground game via volunteers, earned media via rallies, war chest via
fundraising, attacks via oppo research, info via polling). Multiple strategies are viable;
the opponent adapts; events inject variance. The only fixed point is **election day** and
the **win/fail evaluation** — everything between is open.
