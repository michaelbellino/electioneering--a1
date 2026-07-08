# Voter model methodology & verification

Voter intention is a **model**, grounded in real demographics and calibrated to real results, then
verified by tests. This doc explains the model and how its correctness is checked.

## Inputs

1. **Real demographic composition** (per jurisdiction, from Census): the share of CVAP in each
   demographic segment. v1 segments are **race × education**: `white_college`, `white_noncollege`,
   `black`, `hispanic`, `asian`, `other` — the strongest demographic predictors of US vote choice.
2. **Segment behavioural priors** (`src/data/voterModel.ts`): for each segment, a partisan lean,
   partisan strength, per-issue positions, per-issue salience, and turnout propensity. These are
   hand-authored from well-established public voting patterns (the education/racial "diploma divide",
   differential turnout, issue salience) — tunable priors, not ground truth, and not derived from any
   individual voter file.

## Vote-choice model

For voter group *g* and candidate *c*:

```
utility(g, c) = w_spatial  · proximity(g, c)
              + w_partisan · strength_g · clamp(lean_g + offset_j, −1, 1) · partyDir(c)
              + w_valence  · valence_c
              + w_fav      · favorability_c

proximity(g, c) = −Σ_i salience_{g,i} · (pos_{g,i} − pos_{c,i})²  /  Σ_i salience_{g,i}
```

Vote probability within a group is an **awareness-gated softmax** over candidates: a candidate the
group has never heard of (`awareness = 0`) cannot win its votes. Turnout per group scales the group's
relative propensity so the CVAP-weighted average matches the calibrated baseline turnout.

`evaluateElectorate` is **pure and RNG-free** — identical inputs always give identical shares. This is
what makes election night and "what-if" previews replayable.

## Calibration (grounding in real results)

`offset_j` is a per-jurisdiction additive lean offset. At build time we run the model with two symmetric
"generic" party candidates and **bisect `offset_j` until the modelled Democratic two-party share equals
the jurisdiction's real recent lean** (`baselinePartisanLean`). After this, the modelled baseline
reproduces reality; any in-game deviation (a stronger candidate, campaign effects, demographic change)
is the simulation doing its job.

This separates the two concerns cleanly: **demographics are real data; the lean is a calibration
target; the model is the thing in between** — and the model is what we test.

## Verification (it's testable)

`src/engine/electorate/evaluate.test.ts` and `polling.test.ts` assert, among others:

- **Calibration faithfulness:** for every real jurisdiction, the calibrated model reproduces its
  baseline lean within **1 point**.
- **Correct ordering:** safe-D (NY-13) > tossup (PA-07 ≈ 50%) > safe-R (TX-13).
- **Comparative statics:** higher valence ↑ share; higher favorability ↑ share; `awareness = 0` ⇒ ≈0
  votes; moving toward a group on a salient issue ↑ that group's utility.
- **Invariants:** shares sum to 1; turnout ∈ (0, 1]; deterministic re-runs are identical.
- **Polling statistics:** the mean of many polls converges to the true share (unbiased); ~95% of polls
  fall within the margin of error; a house effect biases in the requested direction.

## Roadmap for the model

- Replace the seed snapshot with exact ACS values + a results-calibrated lean (the keyed ETL run).
- Add cross-tab segments (age, urbanicity, religion) and richer salience dynamics.
- Issue-opinion dynamics over time (inertia, response to events/economy) via the effects ledger + a
  Democracy-style simulation graph.
- Validate against held-out real elections (predict an out-of-sample district within tolerance).
