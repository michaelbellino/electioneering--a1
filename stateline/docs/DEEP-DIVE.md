# Stateline — Deep Dive: the mechanics the UI never told you

A high-detail pass over the **actual, full** game (not the early slice). Every claim is grounded in a
specific file; line numbers are approximate to the build at the time of writing. The theme that started
this whole investigation — *"the background options don't tell you what they do"* — turns out to run
through the entire engine: it is deep, largely correct, and almost entirely invisible in play. Several
of the items below are now surfaced in-game via the new hover/focus **ⓘ briefings** (see §9).

---

## 1. Candidate creation — the "background options", decoded

### Attributes → Quality (valence)
`profile.ts` · never shown as a formula:
```
Quality (valence) = clamp01(0.3 + 0.4·Charisma + 0.3·Competence + 0.1·Integrity − 0.25·scandal)
```
- **Charisma dominates** (0.4) and *also* amplifies every `event`-category action by `+charisma·0.3`
  (`logic.ts` `actionMultiplier`) — a double-dip.
- **Fundraising feeds no quality** — it only moves money.
- Quality enters the vote model at weight **0.9**; partisanship weighs **2.6**. So a great candidate in
  the wrong-party seat still loses on fundamentals.

### Point-buy is convex (never shown)
`difficulties.ts`: cumulative cost to raise one attribute — **1 each up to 6, 2 for 7–8, 3 for 9–10**.
So a 6 costs 6 pts, an 8 costs 10, a 10 costs **16**. On Brutal (budget 16) **maxing one attribute
consumes the entire budget**. The creator starts each attribute at 4/10 → 16 pts spent by default.

### Traits ("Background") — exact tradeoffs
`traits.ts` · pick up to 2, each a tradeoff bundle:

| Trait | Effect | Downside |
|---|---|---|
| Hometown Hero | +25 name rec | −5 favorability |
| Self-Funder | +$40,000 cash | −15 fundraising |
| Grassroots Army | +1 action point/week | −$15,000 cash |
| Teflon | −60% scandal damage | −10 charisma |
| Party Insider | −35% staff pay | −10 integrity |
| Outsider | +8 favorability | +35% staff pay |
| Policy Wonk | +15 competence | −10 charisma |
| Firebrand | +15 charisma | −10 integrity |

Hidden gotchas: trait attribute bonuses are applied **after** point-buy and **clamped to 0–100**, so a
bonus onto a maxed attribute is silently wasted; `salaryMult`/`scandalMult` **stack multiplicatively**
across your two traits (Party Insider + Outsider → 0.65 × 1.35 = 0.88, a net salary *discount*); Teflon
only mitigates **self** scandals inside dilemmas. *(These exact effect lines are now printed on each
trait card.)*

### The default-candidate trap
Difficulty **stars are rated against a 0.6/0.6/0.6 candidate with a leaning platform**, but the creator
defaults to **0.4 attributes and an all-centrist platform**. A player who just clicks "Launch" is
materially weaker and blanker than the difficulty assumes.

---

## 2. The vote model (pure, RNG-free)

`evaluate.ts` / `model.ts`, per voter group *g*, candidate *c*:
```
proximity = −Σ salience·(groupPos − candPos)² / Σ salience         (∈ [−4,0])
partisan  = partisanStrength · clamp(lean + calibrationOffset) · partyDir(c)   (D=+1,R=−1,I=0)
utility   = 1.0·proximity + 2.6·partisan + 0.9·valence + 0.9·favorability
voteShare = awareness · exp(utility / 0.55)  ÷  Σ over candidates
```
- **Awareness is a multiplicative gate**: `awareness = 1 − e^(−exposure)`. A candidate with awareness 0
  gets **zero** votes regardless of quality — name recognition has nonlinear, outsized leverage.
- **Six demographic segments** each weight the 8 issues differently (salience 0–2). `white_noncollege`
  is the only strongly-R, high-strength bloc; `black` has the strongest lean (0.74) and strength (0.78)
  but average turnout. The same platform lands differently by demographic mix.
- **calibrationOffset** is a hidden per-jurisdiction additive lean, bisection-fit (60 iterations) so the
  modeled baseline reproduces the real result — the player never sees the true lean being fit to.

---

## 3. Two ad systems, fatigue, and backfire

There are **two coexisting advertising systems**: the flat `tv_ad_*` quick actions, and the deep
**channel × tone × budget** system on the Media desk (`advertising.ts` + `reducer.ts runAd`), which is
where the real mechanics live:

- **Channels**: TV ($18k, awareness 0.45), Radio ($7k, 0.20), Digital ($4k, 0.30 — 30% cheaper with a
  Digital Director), **Direct Mail** ($6k, targetable/local).
- **Ad fatigue**: each buy on a channel multiplies the next by `1/(1 + 0.28·n)` — the 5th TV buy is
  ~0.47× the first. Spreading channels matters. A Comms Director accrues fatigue 30% slower.
- **Attack-ad backfire**: attacking a stance the district **agrees with** (≥ `0.55 + oppoEff·0.12`
  agreement) *helps* your opponent (a rally-round bump) and hurts you. `popularOffset` per policy
  (used **only** here) makes "universal background checks" (+0.30) and "drug-price negotiation" (+0.25)
  the safest attacks, "defund police" (−0.25) the most backfire-prone.
- **Issue ads move public opinion itself**, capped at **±0.08 per issue per campaign** (no decay —
  permanently sticky). **Direct mail** moves a single community's opinion at 3× strength up to ±0.16
  and builds local ground presence — the only targeted persuasion tool.
- **Cost scales with √(electorate size)**: a statewide PA race pays ~4.2× a district's ad rate.

---

## 4. Dilemmas — the roguelike event deck

`data/campaign/dilemmas.ts` (22 dilemmas) + `reducer.ts`:
- Each fires **at most once per run**, never before **week 2**, gated by a weekly roll = difficulty
  `dilemmaChance` (0.35 easy → 0.65 brutal). Ignore one and it **auto-resolves to its default** next tick.
- Consequences can carry cash, scandal, ledger effects, **permanent platform shifts**, and one-week AP.
  "Sign the union pledge" permanently shifts your taxes platform +0.3; "decline the debate" hands the
  **opponent** +0.3 name recognition.
- **Risk gambles**: `badChance = risk.chance · (1 − attribute)`. A maxed mitigating attribute drives the
  bad outcome to **0** (a charisma-1.0 candidate never blows a debate) — except `primary_ghost`, whose
  35% risk has **no mitigating attribute** and is un-buildable-around.

---

## 5. The causal / Influence graph — the sim, differentiated

`causal/graph.ts` powers the Network view. It is **derived, never authored**: every edge weight is a
finite-difference **sensitivity** of the true `evaluateElectorate` share (perturb a lever by 0.05, read
the change in share points). Layers: `action → lever → outcome ← segment ← issue`. Because it *is* the
model's Jacobian, the Network view can never drift from the simulation. The **war chest** lever is
explicitly `sens: null` — "moves no votes by itself."

---

## 6. The opponent AI — a real agent, not a schedule

`ai/agent.ts`: each opponent has a war chest, a **personality playbook**, and a map location, and it
**reacts** to the true shares each week:
- Playbooks weight `[fundraise, positiveAd, attackAd, groundGame]`: frontrunner `[.30,.35,.10,.25]`,
  attack_dog `[.20,.15,.45,.20]`, insurgent `[.25,.10,.15,.50]`.
- **Desperation** (`clamp01(trailing·3)`) shifts a losing AI from positive ads into attacks + ground.
- **3 moves/week, 4 if intensity > 0.65**; AI action magnitudes carry hidden **×3.2–3.4 amplifiers** so
  a modest move budget stays competitive. `intensity = scenario.opponentIntensity · difficultyMult`
  (brutal ×1.7).
- **Likely bug**: hiring *your* Field Director slows the *opponent's* ground-game decay too
  (`reducer.ts` applies the player's decay rate to both presence maps).

---

## 7. Election night is deterministic

`electoral/resolve.ts`: the result is a **pure function** of the end state — `evaluate` is RNG-free,
votes are rounded to whole ballots, FPTP is deterministic, and it sums the map community-by-community
(ground presence becomes real votes via `localProfiles`). The only randomness is a tie-break RNG that
triggers **only on an exact integer-vote tie** — astronomically unlikely. The polls wobble; the outcome
does not. `two_round`, `ranked_choice`, and `electoral_college` are declared but **all fall back to
FPTP**.

---

## 8. Governing, trail map, saves — quick hits

- **Governing** (`governing.ts`, 24-week term) is an **approval-only slice**: your vote/executive action
  nudges *your own* approval (`delta = (sentiment−0.5)·salience·0.25`, executive 0.5), approval
  mean-reverts 3%/week, and there is **no whip mechanic, no AI legislators, no bill passage**. **Political
  capital is earned and displayed but never spent** — a vanity score, for now.
- **Trail map** (`territory/*`): 13 communities (district) or 19 (statewide PA), generated from an urban
  core with archetype tilts; each has a hidden `topIssueId` and `leanOffset` (±0.35). **Fog of war** on
  *numbers* only — you always see exactly **where** every rival is standing. Local actions (rally,
  canvass, speech, direct mail) get a `localReach` up to 1.3× in big media markets; adjacent travel is
  free, a bus tour costs 1 AP.
- **Saves** (`ui/store/saves.ts`): a **12-deep newest-first ring buffer** in localStorage (not 12 named
  slots — oldest silently drop off), **no autosave**; `rematch` re-runs the identical scenario + seed.

---

## 9. Inert / stubbed scaffolding (deliberately over-provisioned)

| Item | Status |
|---|---|
| `EffectChannel: 'persuasion'` | Declared; never produced or consumed |
| `EffectTarget: 'simValue' / 'groupHappiness'`, `op: 'mul'/'set'`, `segmentWeights`, `tone` | Declared; the consumer only sums additive electorate effects |
| `campaign/setStrategy` (tone, focusIssue) | Stored; **read by nothing**, dispatched by no UI |
| `CandidateProfile.incumbent` | Set but never read by the model |
| `ElectoralMethod` two_round / RCV / EC | All fall back to FPTP |
| `GamePhase: 'setup'` | Never entered |
| Staff `manager.effectiveness = 0.8` | Dead — manager effects are presence-based (+1 AP, ×0.75 cooldown) |
| Governing political **capital** | Earned/displayed, **never spent** |
| `policies.ts` "28 stances" comment | Stale — there are **24** (8×3) |

The engine is architected for a much larger game than the current slice exercises — a unified ledger
built for multiplicative/non-electorate effects, tone/segment-weighted persuasion, a multi-method
electoral layer, and a full legislature. What's *live* is: additive electorate effects on four channels
(`nameRecognition`, `favorability`, `turnout`, `enthusiasm`), resolved by FPTP, with a reactive AI and a
deterministic election night.

---

## 10. What this pass changed in the UI

The revitalization surfaces the above where it matters:
- **Candidate creator**: per-attribute hints, exact **trait effect lines**, a live **Quality (valence)**
  readout, and ⓘ briefings on Attributes, Background, Platform, Party.
- **Dashboard**: ⓘ briefings on The Race (awareness gating), Polling (sampled vs true), War Chest (donor
  fatigue), The Team (staff effects), Campaign Actions (local vs district-wide, attack backfire), and the
  Race Wire (estimated war chests, rival playbooks).
- A new **"Election Night, Live"** visual identity: editorial serif display, a reserved broadcast-gold
  emphasis distinct from party colors, a faint situation-room grid, and live motion.

*Method: three parallel static reads across the content, engine, and campaign/governing/trail layers,
each extracting exact numbers with file:line citations, then synthesized here.*
