# Stateline — Critical Design Review, Playtest Report & Forward Plan (July 2026)

A design-critique pass over the **full build** (146 tests, traits/trail/media/influence/governing),
combining three methods:

1. **Static read** of every engine, data, and UI module (with the prior `DEEP-DIVE.md` /
   `VISION-AND-ROADMAP.md` as baseline).
2. **Instrumented Monte-Carlo playtesting** — a new bot harness (`scripts/playtest.ts`, extending
   `scripts/balance.ts`) played **~2,500 complete games** across 10 strategies × 4 difficulties ×
   5 scenarios × dozens of seeds. The deterministic engine runs ~500 full games/second, so every
   claim below is cheap to re-verify: `npx tsx scripts/playtest.ts all 40`.
3. **In-browser playtesting** — scripted Chromium runs through menu → creator → full campaign →
   election night → governing, on two passes, with screenshots. Zero console/page errors.

Verdict up front: **the presentation and architecture are ahead of the game design.** The engine is
excellent, the UI is handsome and increasingly honest, the influence map is genuinely novel — and
underneath it, one strategy dominates everything, the difficulty ladder collapses for a competent
player, the game's primary feedback instrument (the poll) systematically lies, one shipped scenario
is unwinnable at every difficulty, and the governing phase prints its own answer key on screen. All
of it is fixable, most of it cheaply, and the harness now exists to prove each fix.

---

## 1. What is genuinely strong (protect these)

- **The deterministic pure engine is a superpower.** 2,500 full playthroughs in seconds made this
  review possible. It makes balance CI, daily seeds, and replays nearly free. Never compromise it.
- **The Influence Map** — live finite-difference sensitivities of the actual vote model, rendered
  as a causal graph — is the game's most distinctive interface idea. No competitor shows *measured*
  "what actually moves votes for you, this week."
- **The presentation layer sells the fantasy.** Election-night reveal, the trail map with fog of
  war, dilemma writing ("The Manila Envelope", "The Pulpit Invitation") — the writing and visual
  identity are pre-alpha in name only.
- **Content-as-data discipline held.** Actions, traits, dilemmas, difficulties, staff, scenarios,
  ad channels are all data. Every rebalance proposed below is a data edit plus a harness run.
- **The ⓘ briefing pass** closed most of the old "options don't say what they do" gap at the
  explanation level. The gaps that remain (below) are *behavioral*, not textual.

## 2. Playtest findings — the evidence

### 2.1 The difficulty ladder collapses under competent play

Win rate (mean final margin, pts) on PA-07, 40 seeds/cell:

| bot | easy | normal | hard | brutal |
|---|---|---|---|---|
| idle | 0% (−45.8) | 0% (−52.3) | 0% (−60.6) | 0% (−66.0) |
| grinder (rally/speech/fundraise) | 100% (+20.3) | 98% (+13.6) | 40% (−1.9) | 15% (−11.2) |
| ground_game (canvass-first) | 100% (+29.3) | 100% (+21.5) | 70% (+3.5) | 23% (−7.9) |
| tv_spam (quick TV ads) | 83% (+13.9) | 68% (+5.0) | 23% (−14.4) | 8% (−23.5) |
| media_mix (Media desk, rotating channels) | 85% (+6.7) | 48% (−0.9) | 3% (−19.9) | 3% (−30.9) |
| quick_attacker | 57% (−1.4) | 30% (−16.3) | 13% (−26.0) | 3% (−47.6) |
| desk_attacker (targets weakest stance) | 33% (−6.3) | 18% (−15.4) | 3% (−30.5) | 0% (−48.6) |
| **machine** (staff + canvass + rally + TV) | **100% (+39.4)** | **100% (+37.8)** | **98% (+21.7)** | **65% (+4.7)** |

The `machine` bot is a fixed script — no adaptivity, no poll reading, no targeting — and it beats
**hard 98%** of the time and **brutal 65%**, against targets of ~30% and ~10%
(`VISION-AND-ROADMAP.md` M3). The ladder only bites players who don't know the build; difficulty
currently rations *resources*, and resources are exactly what optimized play generates. Knowledge,
not difficulty, is the real gate. (The naive-bot column — grinder at 100/98/40/15 — is what the
tuning was implicitly balanced against, and it looks fine. The ceiling is the problem.)

Two contributing wrinkles found while tracing this:

- **The difficulty cash multiplier flows into the AI's wallet.** `scenario.ts` seeds AI cash as
  `startingCash × (0.8 + fundraising)` where `startingCash` is the *player's post-difficulty,
  post-trait* cash. Easy (cash ×1.5) enriches your opponent; brutal halves their wallet while
  raising their intensity; **player trait cash deltas leak to the AI** (Self-Funder hands the AI
  ~+$50k too). The knobs are entangled in ways the design surely didn't intend.
- **Hiring a Field Director slows the *opponent's* ground-game decay too** (`reducer.ts` computes
  one `decayRate` from the player's staff and applies `decayMap` to both `presence` and
  `oppPresence`). Small but real, and it dampens the one staff hire aimed at the map game.

### 2.2 One strategy dominates: positive exposure stacking

Every above-water strategy is a variation of "buy positive exposure, district-wide, every week."
The systems the game is proudest of — the media desk, targeting, attacks, the map — all
*underperform* the blunt instrument:

- **The deep ad system is dominated by the shallow one.** Marginal true-share gain of the Nth
  positive TV buy in a single week: quick action `tv_ad_positive` (no fatigue, no cooldown):
  `+23.4, +5.0, +2.8, +2.0, +1.7, +1.5, +1.5, +1.4` — a flat ~1.4-pt tail forever. Media-desk TV
  (fatigue applies): `+19.7, +4.4, +2.2, +1.4, +1.0, +0.8, +0.6, +0.5`. The crude button ignores
  `adFatigue` entirely (it lives only in `runAd`) and has `cooldownDays: 0`, so the "diminishing
  returns" system exists but the optimal line routes around it. `media_mix` (48% on normal) loses
  to `grinder` (98%) — **the flagship Media & Polling tab is a strictly worse way to play.**
- **The entire attack layer is a trap.** Both attack bots lose massively (30%/18% on normal vs
  grinder's 98%). Root cause is structural: a challenger's binding constraint is *awareness*
  (`awareness = 1 − e^(−exposure)` multiplies your whole vote share), and attacks buy almost none
  of it while burning AP and cash. The oppo researcher, the backfire mechanic, the "VULNERABLE"
  flags in oppo polls — a whole subsystem currently teaches players to lose. Note also the
  asymmetry: the **quick** attack action has *no* backfire rule at all, while the desk attack does
  — the dumb button is again strictly safer than the smart one.
- **Positive feedback, no counterpressure.** Name recognition → digital-director online donations →
  more ads → more name recognition. Nothing pushes back: no contact fatigue on repeated quick
  actions, no complacency drag when leading, no per-action diminishing returns (an old roadmap
  claim that remains unimplemented for quick actions). Optimal play is rote weekly stacking, which
  is why a fixed script beats "brutal."

### 2.3 The poll — the game's scoreboard — systematically lies

`conductPoll` evaluates the electorate **without the turnout boost** that election night applies
(`conductPollRecord` passes no `turnoutBoost`; `resolveElection` does). Canvassing (`turnout`
channel) and rally `enthusiasm` are therefore invisible in the number the player stares at all
game:

| bot (normal, 40 seeds) | win | mean margin | mean (result − final poll) |
|---|---|---|---|
| machine | 100% | +37.8 | **+14.6 pts** |
| machine (no canvassing) | 93% | +21.0 | **+6.2 pts** |

In the scripted UI playthrough this was vivid: the War Room read **"You trail the leader by 19.3
pts"** in week 3 of a run that ended **"Won by 21.1 pts."** A ground-game player is told they're
losing for fifteen straight weeks and then wins in a landslide. This breaks the core learning loop:
the game's thesis mechanic (the ground game) is precisely the one whose payoff the scoreboard
can't see. GOTV *is* correctly excluded from a "poll" in the simulation-realism sense — but then
the UI must show a modeled-turnout overlay ("likely-voter screen"), because right now the player
has no instrument that reflects a third of their strategy.

### 2.4 Scenario stars are wrong at both ends — and one scenario is unwinnable

Win rates (normal unless noted, machine bot 25–30 seeds):

| scenario | stars | grinder | machine | machine @easy | machine @brutal |
|---|---|---|---|---|---|
| PA-07 Special (Tossup) | 2★ | 100% (+15.1) | 100% (+38.3) | 100% | 65% |
| NY-13: Beat the Machine | 3★ | 0% (−29.9) | **4% (−17.3)** | **0%** | 7% |
| TX-13 Open Seat | 5★ | 0% (−39.4) | 0% (−16.0) | 17% | 0% |
| PA Senate Sprint | 4★ | 100% (+13.7) | 100% (+29.5) | 100% | 67% |

- **NY-13 (3★) is effectively unwinnable at every difficulty** — worse than the 5★ scenario at
  most settings. The cause is mechanical, not tuning: the player is party **I**, so (a) the
  partisan utility term — weight 2.6, the model's biggest — is zeroed *for the player only* in a
  deep-blue seat, and (b) `deriveTurnoutBoostMap` early-outs for `partyDir === 0`, so **canvassing
  and rally enthusiasm do literally nothing for an Independent**. The scenario blurb sells it as "a
  persuasion-and-mobilization puzzle" — mobilization is a no-op for this candidate. This is the
  long-deferred Independent footgun (FIXES.md D1/D2) shipped as star-rated content.
- **PA Senate (4★) is a 100% layup** — easier in practice than the 2★ tossup (the AI doesn't scale
  its behavior to a statewide map, while the player's √-scaled ad costs stay affordable given the
  slack economy, §2.6).
- Stars are currently hand-authored vibes. The harness can *compute* them.

### 2.5 Traits barely matter — except one, which is a trap on the difficulty that needs it most

Single-trait win-rate deltas for the grinder on normal are all within noise (93–100%). On
**brutal** with the machine bot (30 seeds): baseline 63%; `outsider` 83%, `firebrand` 77% (the two
straight stat-ups — their "downsides" are priced in dead currencies: salary multipliers nobody
feels, integrity worth 0.1 valence weight); and **`grassroots_army` 50% with mean margin
collapsing from +5.3 to −18.2** — its −$15k start on brutal's halved $25k wallet destroys the
opening (staff, first rally) that the +1 AP was supposed to feed. "Every trait is a tradeoff,
never strictly better" (`traits.ts`) is not true in outcomes: two are strictly better, one is
occasionally ruinous, five are cosmetic.

### 2.6 The economy is slack

Mean **unspent** cash at election day (normal): grinder **$274k**, ground_game **$244k** — five
times starting cash, sitting idle, in strategies that win ~100%. Only the machine bot (TV spam)
actually consumes its money ($15k left). Consequences: the fundraising attribute and money traits
are near-irrelevant, "Uphill: outspent and outgunned" doesn't actually bind, donor fatigue never
bites (fundraiser cooldown caps uses long before fatigue matters), and the tycoon layer (offices,
staff salaries) is trivially affordable. Money needs sinks or scarcity; right now it's score,
not tension.

### 2.7 Governing is solved on sight

The bill card prints **"52% back it"** next to the vote buttons. Autoplay across 30 seeds:

| governing bot | mean final approval | range |
|---|---|---|
| vote with the printed number | **73%** | 66–80% |
| vote against it | 11% | 2–19% |
| never vote | 24% | 24–24% (deterministic) |

There is no decision: the optimal move is displayed, there's no party pressure, no
platform-consistency cost, no whip mechanic, and **political capital is earned but spendable on
nothing**. It's a 24-click victory lap. (As a *placeholder loop-closer* it does its narrative job —
taking the seat feels right — but it should not grow content in this shape.)

### 2.8 Cadence and credibility notes from the browser playtest

- **Dilemma pressure is relentless**: 14 dilemmas in 18 played weeks (normal is 45%/week; the deck
  is 22 cards, once each per run). Every-other-week interruptions with a modal is a lot; and two
  runs nearly exhaust the deck.
- **The influence map displays "Black — 100% with you."** True to the model (softmax τ=0.55 with a
  2.6-weight partisan term saturates), but a 100%-support demographic reads as a simulation bug to
  any politically literate player. The model needs saturation damping (or the display needs
  honest uncertainty).
- Election night's community-by-community reveal + confetti is excellent; the "seed" chip and
  "Run it back" are great replay affordances.
- Minor: floating +/− delta animations can overlap panel content; the creator defaults to 4/4/4/4
  with **8 of 24 points unspent** and nothing nudging the player to spend them before Launch (the
  known "default-candidate trap", still live).

## 3. Root-cause design assessment

The findings above are symptoms of five underlying design debts:

1. **Exposure is the only real currency.** The awareness gate multiplies everything, exposure is
   additive with no per-action diminishing returns, and positive loops feed it. Until repetition
   gets more expensive (fatigue everywhere) and leads generate complacency, "more positive
   exposure" beats strategy, and every distinctive system loses to the blunt one.
2. **The strategic surface is deeper than the payoff surface.** Targeting, channels, tones,
   attacks, the map — presentationally rich, but the outcome math rewards none of them over
   district-wide stacking. Depth players discover this within a session; the game teaches its own
   shallowness.
3. **Feedback integrity is broken in one direction.** The poll under-reports the player's true
   position by up to ~15 points for exactly the play styles the design wants to encourage. Fixing
   information honesty is cheaper than any content and multiplies the value of everything else.
4. **Difficulty scales resources, not intelligence.** The AI works harder (more moves, bigger
   amplifiers) but never *smarter* (it doesn't poll, target the player's weaknesses, or adapt
   playbooks). Resource knobs can't stop an optimizing player; only a reactive opponent can.
5. **The second phase has no game in it yet.** Governing displays its answer key and banks
   unspendable capital.

## 4. The plan — prioritized, sequenced, measurable

Every item names its acceptance test in harness terms. Run
`npx tsx scripts/playtest.ts all 40` before/after; the suite takes ~6 seconds.

### P0 — Integrity fixes (days; do before any new content)

1. **Make the scoreboard honest.** Pass the turnout/enthusiasm boost into the poll evaluation as a
   "likely-voter model" (`conductPollRecord` → `conductPoll` → `evaluateElectorate` already accepts
   `turnoutBoost` — it's a parameter plumb-through), or add a separate visible "turnout edge"
   indicator fed by the same map. *Accept:* mean |result − final poll| < the reported MoE for the
   machine bot (currently +14.6 pts vs ±4).
2. **Unify the two ad systems.** Make quick `tv_ad_positive`/`tv_ad_attack` thin presets over the
   `runAd` pipeline so ad fatigue and backfire apply everywhere; alternatively give quick ads a
   shared fatigue counter. *Accept:* marginal-gain tail of quick-ad spam ≈ media-desk tail
   (both decaying), and `media_mix` win rate ≥ `tv_spam` on normal.
3. **Fix the Field Director decay bug** (player staff slows opponent presence decay) and
   **decouple AI wallets from player cash multipliers/traits** (give scenarios an explicit
   opponent war chest, scaled by `opponentMult`, not by the player's `cashMult`/trait deltas).
   *Accept:* trait cash deltas no longer move AI cash; brutal AI is not poorer than normal AI.
4. **Repair or re-scope NY-13.** Either (a) implement Independent turnout targeting (favorable
   groups = sign-agnostic: groups whose utility for you exceeds their utility for the field — the
   engine already computes per-group shares in `crosstabs`), or (b) make it an actual D-vs-D
   primary (both candidates `D`, the partisan term washes symmetrically). *Accept:* machine bot
   wins 20–45% on normal (it's meant to be hard, not fake).
5. **Recompute scenario stars from the harness** (e.g. map machine-bot normal win rate:
   ≥85% → 1–2★, 60–85% → 3★, 30–60% → 4★, <30% → 5★) and re-label PA Senate. *Accept:* stars
   monotone in measured win rate.

### P1 — Break the dominant strategy (the big balance pass; ~weeks)

6. **Anti-grind pressure, everywhere.** Per-action-per-community contact fatigue (repeat rallies
   in one town decay in yield), complacency (leading in the polls decays your own enthusiasm
   channel), and per-action diminishing returns via buy history. *Accept:* machine bot falls to
   ≤60% on hard and ≤25% on brutal **without** touching resource knobs.
7. **Make the AI play the player's game at higher difficulties.** It already reads true shares;
   let hard/brutal AI (a) counter-attack the player's weakest stance (it has `positions` and
   `agreementShare` available), (b) contest the player's strongest communities, (c) switch
   playbooks when trailing badly (it only shifts weights today). This is pre-work for M1's real
   agents, scoped to the existing `runAiTurn`. *Accept:* difficulty ladder for the machine bot hits
   ~75/50/30/10 ±10, and the `desperation` code path visibly changes AI action mix in logs.
8. **Rehabilitate attacks.** Attacks should suppress the *target's* enthusiasm/turnout (that's
   what negative advertising does) in addition to favorability, and oppo research should unlock
   dilemma-style scandal events rather than just sharpen numbers. Give the quick attack the same
   backfire rule as the desk. *Accept:* a tuned attacker bot lands within 15 win-rate points of
   the grinder on normal, and backfire fires in logs for bad targets.
9. **Tighten the economy.** Escalating ad rates as election day nears (airtime scarcity), office
   upkeep, or a hard weekly spend cap that staff raise. Goal: the fundraising attribute and money
   traits become real choices. *Accept:* grinder's mean unspent cash < 30% of raised (now ~85%).
10. **Trait rebalance with the harness.** Re-cost `outsider`/`firebrand` downsides in live
    currencies (e.g. `outsider`: −name-rec with party bases; `firebrand`: +scandal risk on event
    actions), and make `grassroots_army`'s cash cost scale with difficulty cash (−30% of starting
    cash, not flat −$15k). *Accept:* every single-trait delta within ±8 win-rate points of
    baseline on both normal and brutal.

### P2 — Give governing a game (before growing its content)

11. **Hide the answer, add the tensions.** Replace the printed district agreement with a noisy
    staff estimate (pollster sharpens it); add party-line pressure (defecting costs capital),
    platform consistency (voting against your own stated stance hits favorability with your base —
    the data already exists: candidate `positions` vs bill direction), and **capital spends**
    (push a bill onto the docket, trade a vote, fund a district project). *Accept:* the
    "vote-with-the-number" bot no longer converges to 73±7% — strategies with different
    capital use produce ≥15-point approval spreads.
12. **Close the full loop: term → re-election.** Bake opinion shifts and approval into the next
    campaign's starting conditions (the engine's persistence design intent). Re-election is the
    real score for the governing phase; the term report should feed a "Run for re-election"
    button. *Accept:* an e2e test runs campaign → govern → campaign on one seed deterministically.

### P3 — Then the structural unlock (M1 from VISION-AND-ROADMAP)

13. **Multi-candidate races + AI candidates as budgeted agents** stays the right big bet — this
    review's evidence *raises* its priority rationale: the binding constraint on challenge is
    opponent intelligence, and M1 is where the AI becomes a peer playing the same reducer. Do it
    after P0/P1 so the new agents inherit an economy and action space where more than one strategy
    works — otherwise M1 ships N copies of an opponent that loses to exposure-stacking.
14. **Content runway behind it:** dilemma deck 22 → 40+ with a cadence governor (cap: no more
    than 1 dilemma per 2 weeks; scale `dilemmaChance` down after each fire), deterministic
    state-triggered situations (scandal spiral, volunteer surge) with hysteresis, and the Census
    ETL run so "real data" is finally real.

### Cross-cutting: institutionalize the harness

- `scripts/playtest.ts` (added with this review) is now the ground truth for every balance claim.
  Add a slim CI gate: matrix at 12 seeds/cell asserting win-rate *bands* per (bot × difficulty)
  cell — e.g. machine ∈ [60,90] on easy, ≤40 on brutal — so balance regressions fail loudly, the
  same way `balance.test.ts` already guards monotonicity.
- Every P0–P2 item above lands with its acceptance line added as a test.

## 5. What this changes in the existing roadmap

`VISION-AND-ROADMAP.md` remains directionally right; this review re-orders its middle:

- **"Balance is unvalidated" (weakness #5) → validated now, and worse than suspected.** The
  suspected dominant loop (fundraiser→AP) turned out *not* to be it — money is slack (§2.6); the
  real dominant loop is positive-exposure stacking through the fatigue-free quick actions (§2.2).
- **M3's balance harness should not wait for M3.** It exists as of this review and P0/P1 depend
  on it; the win-rate targets move from "M3 goal" to "P1 acceptance criteria."
- **M2 (electorate v2) partially lands early**: contact fatigue/complacency (P1.6) are pulled
  forward because they're what breaks the dominant strategy; the rest of M2 (segment priorities as
  hidden info, per-community opinion everywhere) stays sequenced after M1.
- **M1 (multi-candidate) moves from "next" to "after P0/P1"** — about two working weeks of
  integrity-and-balance work first, so the multi-agent world inherits a game where strategy
  diversity is real.

---

*Reproduce everything: `cd stateline && npx tsx scripts/playtest.ts all 40` (≈6s), or per
experiment: `matrix | scenarios | gotv | traits | adspam | attacks | governing | drama | followup`.
UI pass: `npm run dev`, then drive Chromium with Playwright (screenshots in the session record).*
