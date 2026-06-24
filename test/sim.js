/*
 * Campaign Trail — headless simulation harness (Node).
 *
 *   node test/sim.js          # run all assertions, exit non-zero on failure
 *   node test/sim.js --report # verbose per-strategy / per-seed breakdown
 *
 * Proves the engine is balanced and complete WITHOUT any UI:
 *   (a) a sensible "defend the lead" strategy WINS on Normal on >= 1 seed
 *   (b) idle play and over-leveraged play reach EACH fail condition:
 *         fail_electoral_loss, fail_bankruptcy, fail_scandal_collapse
 *   (c) determinism: same (seed, candidate, difficulty, actions) replays identically
 *   (d) structural invariants: 18 regions, EV sum 538, no crashes across a sweep
 *
 * Everything runs through the public engine API only.
 */
'use strict';
var path = require('path');
var Engine = require(path.join(__dirname, '..', 'src', 'engine.js'));
var Data = require(path.join(__dirname, '..', 'src', 'data.js'));

var REPORT = process.argv.indexOf('--report') !== -1;
var C = Engine.constants;

/* ----------------------------------------------------------------------- *
 * Generic game runner: drives a game to completion with a strategy fn and
 * an event-choice policy. Returns the final state + a per-turn trace.
 * ----------------------------------------------------------------------- */
function run(opts) {
  var g = Engine.create({ seed: opts.seed, candidateId: opts.candidateId, difficulty: opts.difficulty });
  var eventPolicy = opts.eventPolicy || function (ev) { return ev.choices[0].id; };
  var strategy = opts.strategy;
  var trace = [];
  var guard = 0;
  while (g.getState().status === 'playing' && guard++ < 40) {
    if (g.hasPendingEvent()) {
      var ev = g.getPendingEvent();
      g.resolveEvent(eventPolicy(ev, g.getState()));
    }
    // a strategy may resolve further events it triggers; loop until settled
    strategy(g);
    if (g.hasPendingEvent()) { var ev2 = g.getPendingEvent(); g.resolveEvent(eventPolicy(ev2, g.getState())); }
    var st = g.getState();
    trace.push({ turn: st.turn, funds: Math.round(st.resources.funds), ap: st.resources.actionPoints,
      vol: +st.resources.volunteers.toFixed(1), mom: +st.national.momentum.toFixed(1),
      scandal: +st.national.scandalLevel.toFixed(1), pEV: st.tally.decisive.playerEV });
    var r = g.endTurn();
    if (!r.ok) break;
  }
  var fs = g.getState();
  return { state: fs, status: fs.status, condition: fs.endCondition, reason: fs.endReason, trace: trace, save: g.save() };
}

/* ----------------------------------------------------------------------- *
 * Event-choice policies
 * ----------------------------------------------------------------------- */
function safestChoice(ev) {
  // pick the choice whose net scandal delta is lowest (defensive play)
  var best = ev.choices[0], bestScore = Infinity;
  ev.choices.forEach(function (c) {
    var score = 0;
    (c.effects || []).forEach(function (e) {
      if (e.type === 'scandalLevel') score += e.value * 2;
      if (e.type === 'funds') score -= e.value * 0.02;
      if (e.type === 'momentum') score -= e.value * 0.5;
      if (e.type === 'nationalApproval') score -= e.value;
    });
    if (score < bestScore) { bestScore = score; best = c; }
  });
  return best.id;
}
function worstChoice(ev) {
  // pick the most self-destructive choice (max scandal / min funds) — for fail tests
  var best = ev.choices[0], bestScore = -Infinity;
  ev.choices.forEach(function (c) {
    var score = 0;
    (c.effects || []).forEach(function (e) {
      if (e.type === 'scandalLevel') score += e.value * 2;
      if (e.type === 'funds') score -= e.value * 0.05;
    });
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best.id;
}

/* ----------------------------------------------------------------------- *
 * Strategies (each spends down AP for the current turn)
 * ----------------------------------------------------------------------- */
// Smart "defend the lead": triage scandal/opponent/funds, then shore up the
// most threatened player-leaning swing regions (and flip the cheapest tossups).
function smartDefend(g) {
  var safety = 0;
  while (g.getState().resources.actionPoints > 0 && safety++ < 12) {
    var st = g.getState();
    var n = st.national;
    // 1) keep scandal away from the cliff
    if (n.scandalLevel >= 45 && g.canAfford('damage_control')) { if (g.doAction('damage_control').ok) continue; }
    // 2) suppress an opponent on a roll
    if (st.opponent.momentum >= 38 && g.canAfford('counter_messaging')) { if (g.doAction('counter_messaging').ok) continue; }
    // 3) stay solvent (raise while still ahead)
    if (st.resources.funds < 360 && g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    // 4) defend: the thinnest player-leaning contested region, then cheap tossups
    var defendable = st.regions.filter(function (r) { return r.lean > 0 && r.lean < 38; })
      .sort(function (a, b) { return a.lean - b.lean; });
    var tossups = st.regions.filter(function (r) { return r.lean <= 0 && r.lean > -16; })
      .sort(function (a, b) { return (b.electoralVotes) - (a.electoralVotes); });
    var target = defendable[0] || tossups[0];
    if (target) {
      // prefer sticky ground if we have a volunteer base, else air war
      var actId = (st.resources.volunteers >= 10 && g.canAfford('volunteer_canvass', target.id)) ? 'volunteer_canvass'
        : (g.canAfford('tv_ad_blitz', target.id) ? 'tv_ad_blitz' : null);
      if (actId && g.doAction(actId, target.id).ok) continue;
    }
    // fallback: fundraise or stop
    if (g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    break;
  }
}

// Ground-game lane: build offices early, recruit, then canvass.
function groundGame(g) {
  var safety = 0;
  while (g.getState().resources.actionPoints > 0 && safety++ < 12) {
    var st = g.getState();
    if (st.resources.funds < 250 && g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    var swing = st.regions.filter(function (r) { return r.lean > -10 && r.lean < 35; }).sort(function (a, b) { return a.lean - b.lean; });
    var t = swing[0];
    if (st.turn <= 5 && t && g.canAfford('build_field_office', t.id)) { if (g.doAction('build_field_office', t.id).ok) continue; }
    if (st.resources.volunteers < 24 && g.canAfford('recruit_volunteers')) { if (g.doAction('recruit_volunteers').ok) continue; }
    if (t && g.canAfford('volunteer_canvass', t.id)) { if (g.doAction('volunteer_canvass', t.id).ok) continue; }
    if (g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    break;
  }
}

// Idle: do nothing.
function idle(g) { /* spend no AP */ }

// Scandal-reckless: maximize self-inflicted scandal — opposition research
// (backfire +12), attack ads (+3) everywhere, fundraise only to keep attacking,
// and NEVER run damage control. Once scandal clears 40 the opponent piles on,
// driving scandalLevel to the 80 collapse line.
function scandalReckless(g) {
  var safety = 0;
  while (g.getState().resources.actionPoints > 0 && safety++ < 12) {
    var st = g.getState();
    if (g.canAfford('opposition_research')) { if (g.doAction('opposition_research').ok) continue; }
    var t = st.regions.filter(function (r) { return Math.abs(r.lean) < 40; })
      .sort(function (a, b) { return b.electoralVotes - a.electoralVotes; })[0];
    if (t && g.canAfford('attack_ad', t.id)) { if (g.doAction('attack_ad', t.id).ok) continue; }
    if (g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    break;
  }
}

// Over-leveraged collapse (outsider). Bankruptcy is heavily grace-protected by
// design ("real but grace-protected by volunteers/momentum"): you only fold if
// you are broke AND volunteer-less AND out of momentum at the same time. Only
// the charismatic outsider (4 starting volunteers) can attrition below 3 within
// 12 weeks, and they start at +20 momentum — so this pathological strategy
// deliberately tanks national momentum below zero with back-to-back fundraisers
// early, blows every dollar on vanity ad buys in already-safe regions (zero
// electoral return), and never builds a ground game. By the late game the
// campaign is volunteer-less with negative momentum, so the next funds-draining
// event tips it insolvent. Empirically ~9% of seeds, so a 120-seed sweep proves
// reachability without flakiness.
function overLeveraged(g) {
  var safety = 0;
  while (g.getState().resources.actionPoints > 0 && safety++ < 12) {
    var st = g.getState();
    var n = st.national;
    var early = st.turn <= 7;
    if (early && n.momentum > -6 && g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    var safe = st.regions.filter(function (r) { return r.lean >= 42; })
      .sort(function (a, b) { return b.mediaCostMultiplier - a.mediaCostMultiplier; })[0]
      || st.regions.slice().sort(function (a, b) { return b.lean - a.lean; })[0];
    if (safe && g.canAfford('tv_ad_blitz', safe.id)) { if (g.doAction('tv_ad_blitz', safe.id).ok) continue; }
    if (early && g.canAfford('major_fundraiser')) { if (g.doAction('major_fundraiser').ok) continue; }
    break;
  }
}

/* ----------------------------------------------------------------------- *
 * Sweep helpers
 * ----------------------------------------------------------------------- */
function seeds(n, prefix) { var a = []; for (var i = 0; i < n; i++) a.push((prefix || 's') + '-' + i); return a; }

function sweep(label, cfg) {
  var results = { won: 0, lost: 0, conditions: {}, wins: [], samples: [] };
  cfg.seeds.forEach(function (sd) {
    var r = run({ seed: sd, candidateId: cfg.candidateId, difficulty: cfg.difficulty, strategy: cfg.strategy, eventPolicy: cfg.eventPolicy });
    results[r.status] = (results[r.status] || 0) + 1;
    results.conditions[r.condition] = (results.conditions[r.condition] || 0) + 1;
    if (r.status === 'won') results.wins.push(sd);
    results.samples.push(r);
  });
  if (REPORT) {
    console.log('\n[' + label + '] cand=' + cfg.candidateId + ' diff=' + cfg.difficulty + ' n=' + cfg.seeds.length);
    console.log('   won=' + (results.won || 0) + ' lost=' + (results.lost || 0) + '  conditions=' + JSON.stringify(results.conditions));
    var ex = results.samples[0];
    console.log('   sample[' + ex.state.seed + ']: ' + ex.status + ' / ' + ex.condition);
    ex.trace.forEach(function (t) {
      console.log('     wk' + String(t.turn).padStart(2) + ' funds=' + String(t.funds).padStart(5) + ' vol=' + String(t.vol).padStart(5) + ' mom=' + String(t.mom).padStart(6) + ' scd=' + String(t.scandal).padStart(5) + ' pEV=' + String(t.pEV).padStart(3));
    });
  }
  return results;
}

/* ----------------------------------------------------------------------- *
 * Assertions
 * ----------------------------------------------------------------------- */
var failures = [];
var passes = [];
function assert(cond, msg) { if (cond) { passes.push(msg); } else { failures.push(msg); } console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); }

console.log('=== Campaign Trail — simulation harness ===\n');

// (d) structural invariants
var evSum = Data.regions.reduce(function (s, r) { return s + r.electoralVotes; }, 0);
assert(Data.regions.length === 18, 'structure: 18 regions');
assert(evSum === C.TOTAL_EV, 'structure: electoral votes sum to ' + C.TOTAL_EV + ' (got ' + evSum + ')');
assert(C.VOTES_TO_WIN === 270 && C.MAX_TURNS === 12, 'structure: 270 to win over 12 turns');

// (c) determinism
(function () {
  function play(seed) {
    return run({ seed: seed, candidateId: 'grassroots_organizer', difficulty: 'normal', strategy: groundGame, eventPolicy: safestChoice }).save;
  }
  assert(play('determinism') === play('determinism'), 'determinism: identical replay for same seed + actions');
})();

// (a) smart strategy WINS on Normal on >= 1 seed (test all three candidates)
var SEEDS = seeds(24, 'normal');
var smartIns = sweep('smart/insider', { seeds: SEEDS, candidateId: 'seasoned_insider', difficulty: 'normal', strategy: smartDefend, eventPolicy: safestChoice });
var smartOrg = sweep('ground/organizer', { seeds: SEEDS, candidateId: 'grassroots_organizer', difficulty: 'normal', strategy: groundGame, eventPolicy: safestChoice });
var smartOut = sweep('smart/outsider', { seeds: SEEDS, candidateId: 'charismatic_outsider', difficulty: 'normal', strategy: smartDefend, eventPolicy: safestChoice });
assert((smartIns.won || 0) >= 1, 'winnable: smart insider wins >= 1/' + SEEDS.length + ' Normal seeds (won ' + (smartIns.won || 0) + ')');
assert((smartOrg.won || 0) >= 1, 'winnable: ground-game organizer wins >= 1/' + SEEDS.length + ' Normal seeds (won ' + (smartOrg.won || 0) + ')');
var smartWinRate = (smartIns.won + smartOrg.won + smartOut.won) / (3 * SEEDS.length);
assert(smartWinRate >= 0.5, 'balance: smart play wins a majority of Normal games (rate ' + (smartWinRate * 100).toFixed(0) + '%)');

// (b1) idle play loses by electoral defeat
var idleR = sweep('idle', { seeds: SEEDS, candidateId: 'seasoned_insider', difficulty: 'normal', strategy: idle, eventPolicy: safestChoice });
assert((idleR.conditions.fail_electoral_loss || 0) >= 1, 'reachable fail: electoral loss via idle play (' + (idleR.conditions.fail_electoral_loss || 0) + '/' + SEEDS.length + ')');
assert((idleR.won || 0) === 0, 'balance: idle play never wins on Normal');

// (b2) scandal collapse reachable (~25% of seeds; 40-seed sweep proves it)
var SC_SEEDS = seeds(40, 'scandal');
var scandalR = sweep('scandalReckless', { seeds: SC_SEEDS, candidateId: 'charismatic_outsider', difficulty: 'normal', strategy: scandalReckless, eventPolicy: worstChoice });
assert((scandalR.conditions.fail_scandal_collapse || 0) >= 1, 'reachable fail: scandal collapse via reckless attacks (' + (scandalR.conditions.fail_scandal_collapse || 0) + '/' + SC_SEEDS.length + ')');

// (b3) bankruptcy reachable (rare-by-design; large sweep proves it without flake)
var BSEEDS = seeds(120, 'bank');
var bankR = sweep('overLeveraged', { seeds: BSEEDS, candidateId: 'charismatic_outsider', difficulty: 'normal', strategy: overLeveraged, eventPolicy: worstChoice });
assert((bankR.conditions.fail_bankruptcy || 0) >= 1, 'reachable fail: bankruptcy via over-leverage (' + (bankR.conditions.fail_bankruptcy || 0) + '/' + BSEEDS.length + ')');

// difficulty monotonicity: smart play should win less as difficulty rises
var easyR = sweep('smart/easy', { seeds: SEEDS, candidateId: 'seasoned_insider', difficulty: 'easy', strategy: smartDefend, eventPolicy: safestChoice });
var hardR = sweep('smart/hard', { seeds: SEEDS, candidateId: 'seasoned_insider', difficulty: 'hard', strategy: smartDefend, eventPolicy: safestChoice });
assert((easyR.won || 0) >= (smartIns.won || 0) && (smartIns.won || 0) >= (hardR.won || 0),
  'balance: win rate is monotonic easy(' + easyR.won + ') >= normal(' + smartIns.won + ') >= hard(' + hardR.won + ')');

/* ----------------------------------------------------------------------- *
 * Summary
 * ----------------------------------------------------------------------- */
console.log('\n=== summary ===');
console.log('idle:               ' + JSON.stringify(idleR.conditions));
console.log('smart/insider:      won ' + smartIns.won + '/' + SEEDS.length + '  ' + JSON.stringify(smartIns.conditions));
console.log('ground/organizer:   won ' + smartOrg.won + '/' + SEEDS.length + '  ' + JSON.stringify(smartOrg.conditions));
console.log('smart/outsider:     won ' + smartOut.won + '/' + SEEDS.length + '  ' + JSON.stringify(smartOut.conditions));
console.log('easy/normal/hard:   ' + easyR.won + ' / ' + smartIns.won + ' / ' + hardR.won + ' (of ' + SEEDS.length + ')');
console.log('scandalReckless:    ' + JSON.stringify(scandalR.conditions));
console.log('overLeveraged:      ' + JSON.stringify(bankR.conditions));

console.log('\n' + passes.length + ' passed, ' + failures.length + ' failed.');
if (failures.length) { console.log('\nFAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); process.exit(1); }
console.log('\nAll assertions passed.');
process.exit(0);
