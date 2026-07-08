# Stateline — critical review & the road to the true vision

*The vision: a sandbox political simulation where you take a candidate from the campaign trail to
the legislature — any seat, any level, every run different — with a causal model deep enough that
strategy is real and a world persistent enough that winning is only the beginning.*

Status: pre-alpha (campaign phase only). This doc is an honest audit of what exists, what's weak,
and the ordered milestones to the vision.

## What is genuinely strong (protect these)

1. **The deterministic pure engine.** No RNG/time outside seeded streams, byte-identical
   save/load, 126 tests including replay determinism. This is the single most valuable asset —
   it makes everything else (balance bots, daily challenges, multiplayer-by-seed, modding) cheap.
2. **A real causal chain, not vibes.** 24 policy stances → 8 calibrated issue areas →
   segment-weighted utility → votes; the Influence Map shows *measured* sensitivities
   (finite differences of the live model). Democracy-style transparency, actually earned.
3. **The spatial identity.** Seed-generated district maps, travel, ground presence, fog-of-war
   intel. No competitor (TPP, Democracy, Political Machine) has this loop. It is the game's
   distinctive thesis: *campaigns are fought somewhere.*
4. **Content-as-data discipline.** Actions, dilemmas, traits, difficulties, staff, scenarios,
   policies, districts — all data. The modding story already exists structurally.

## Critical weaknesses (ranked by how much they block the vision)

1. **Two-candidate hardcoding.** The reducer, AI, UI, and scenario shape assume exactly player +
   one opponent. This blocks primaries, three-way races, party benches, and generated fields —
   the "factions" half of the sandbox. Highest-priority structural debt.
2. **The opponent is a script, not a player.** It emits fixed weekly exposure and wanders the
   map; it has no cash, buys no ads, reads no polls, makes no tradeoffs. "Track the opposition"
   is shallow because there is little to track. AI candidates must share the player's action
   space and budgets (an agent policy over the same reducer actions).
3. **Electorate model is one generation behind the design.** Missing (all researched, specced by
   TPP/D4 findings): enthusiasm as a separate currency from preference (turnout vs persuasion),
   per-segment issue *priorities* as discoverable hidden information, contact fatigue /
   complacency / flip-flop cynicism (no anti-grind pressure today), and segment- or
   community-level opinion (shifts are district-global).
4. **The map is advisory, not ground truth.** Election night is a district-level evaluation;
   community standings are a decomposition for display. Presence nudges local awareness but the
   result doesn't sum from places. Until the election IS the aggregation of communities, spatial
   strategy is soft.
5. **Balance is unvalidated.** No automated playtesting; the fundraiser→AP loop is probably
   dominant; brutal may be unwinnable-in-fact rather than by design. The deterministic engine
   makes a balance harness (bots × 1,000 seeds × difficulty, win-rate targets) almost free —
   build it before tuning by hand.
6. **Content runway is short.** 12 dilemmas (~1.5 runs before repeats), 6 quick actions, no
   deterministic state-triggered events (D4's situations with hysteresis — scandal spirals,
   grassroots surges). Variety currently leans on geography and race choice.
7. **Data is provisional.** PA's 17 districts are hand-authored approximations; the Census ETL
   exists but hasn't been run; 49 states absent. Fine for pre-alpha; must be real before "any
   district in the country."
8. **No governing phase.** The second half of the vision is unstarted. Roadmap Phase 2 exists on
   paper only.
9. **UX debt.** Engine supports save/load but no UI for it; no run history; no advisor/onboarding
   (three tabs of systems with no guidance); map color still leans on hue (numbers + fog help);
   new tabs (Media, Trail) lack component tests.

## Milestones to the vision (ordered, each shippable)

### M1 — Multi-candidate core (the unlock)
Parties as data (D/R/I factions with generated benches: names, attributes, war chests, platforms
from district ideology). Races carry N candidates end-to-end (reducer/UI/polls/allocators mostly
support arrays already — remove the pair assumptions). Primary → general calendar (two elections,
one run). **AI candidates as budgeted agents over the same action space** (weekly: assess polls →
allocate AP/cash across travel/ads/fundraising/ground game, seeded personalities: attack-dog,
frontrunner-safe, insurgent). Race Wire panel: every candidate's estimated cash, momentum, last
seen location, endorsements — with estimates sharpened by opposition research.

### M2 — Electorate v2 (depth that kills the grind)
Enthusiasm separate from preference (drives turnout; independents break to enthusiasm). Segment
priorities as hidden info (canvass = noisy read, polls = exact). Contact fatigue + complacency +
flip-flop cynicism. Opinion shifts become per-community × per-segment. **Election night = sum of
community results** (the map becomes the ground truth). Community-targeted ads and rally
spillover along the adjacency graph.

### M3 — Content, balance & persistence
Balance harness (bot strategies × seeds × difficulties; tune to win-rate targets: easy ~75%,
normal ~50%, hard ~30%, brutal ~10%). Dilemma deck to 40+ with prerequisites; deterministic
situations (scandal spiral, volunteer surge) with hysteresis and warnings. Save/load UI, run
history, seed sharing. Run the Census ETL for real PA data.

### M4 — Governing (campaign → legislature, the vision's second half)
Win → take the seat, world persists: opinion shifts baked (90% persistence), approval tracking
begins. A generated chamber (start: PA House or the US House delegation) of NPC legislators with
policy sheets derived from their districts. **Bill drafting as parameterized forms** (sliders per
provision), pre-file Support Analysis (per-legislator whip count *with reasons*), committee
chairs who can kill hearings, floor votes, executive veto/override. Political capital earned from
wins/fundraising/rallies; relationship points spent to flip votes. Enacted laws lower into the
same effects ledger → world metrics → approval → the NEXT election (re-election as the score).
Career ladder + protégés after that.

### M5 — Nation & platform
ETL all 50 states + districts; office taxonomy (school board → president); content packs
(manifest + Zod validation, the Subway Builder pattern); Tauri desktop packaging; seeded daily
challenge with shared leaderboard-by-honor.

## Recommended next move

**M1.** Multi-candidate + real AI agents is the highest-leverage step: it converts every existing
system (map, ads, polls, dilemmas, staff) from "player vs script" into a live political world,
and it is the prerequisite for primaries, factions, and eventually the legislature's NPC
politicians — the same generated-politician machinery serves both halves of the game.
