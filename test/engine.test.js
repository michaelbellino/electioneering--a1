/*
 * Engine unit tests — Node's built-in test runner (no dependencies).
 *
 *   npm test            # run once
 *   npm run test:watch  # red -> green -> refactor TDD loop (re-runs on save)
 *
 * Granular, fast (<1s) tests of the public Campaign.Engine API and every rule,
 * written to be driven test-first. Higher-level balance (test/sim.js) and
 * rendered-UI (test/dom-smoke.js) suites live alongside these.
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Engine = require(path.join(__dirname, '..', 'src', 'engine.js'));
const Data = require(path.join(__dirname, '..', 'src', 'data.js'));

/* ---- helpers ---- */
function newGame(opts) {
  return Engine.create(Object.assign({ seed: 'unit', candidateId: 'seasoned_insider', difficulty: 'normal' }, opts || {}));
}
function clearEvent(g) { if (g.hasPendingEvent()) { const e = g.getPendingEvent(); g.resolveEvent(e.choices[0].id); } }
function findRegion(state, pred) { return state.regions.filter(pred)[0]; }
// Craft an arbitrary engine state via save/load (no pending event) to unit-test rules.
function craft(mutate) {
  const g = newGame();
  const saved = JSON.parse(g.save());
  saved.state.pendingEvent = null;
  mutate(saved.state);
  return Engine.load(JSON.stringify(saved));
}

describe('create()', () => {
  it('starts a 12-week game in the playing state with 5 AP', () => {
    const s = newGame().getState();
    assert.equal(s.status, 'playing');
    assert.equal(s.turn, 1);
    assert.equal(s.maxTurns, 12);
    assert.equal(s.resources.actionPoints, 5);
  });
  it('has 18 regions summing to exactly 538 electoral votes', () => {
    const s = newGame().getState();
    assert.equal(s.regions.length, 18);
    assert.equal(s.regions.reduce((a, r) => a + r.electoralVotes, 0), 538);
  });
  it('projects the published 295 / 243 decisive lead at kickoff', () => {
    const t = newGame().tally();
    assert.equal(t.decisive.playerEV, 295);
    assert.equal(t.decisive.oppEV, 243);
    assert.equal(t.decisive.playerEV + t.decisive.oppEV, 538);
  });
  it('applies candidate starting modifiers', () => {
    assert.equal(newGame({ candidateId: 'seasoned_insider' }).getState().resources.funds, 1450);
    const org = newGame({ candidateId: 'grassroots_organizer' }).getState();
    assert.equal(org.resources.volunteers, 16);
    assert.equal(org.resources.funds, 950);
    const out = newGame({ candidateId: 'charismatic_outsider' }).getState();
    assert.equal(out.national.momentum, 20);
    assert.equal(out.resources.volunteers, 4);
  });
});

describe('availableActions() / canAfford()', () => {
  it('exposes all 12 actions', () => {
    assert.equal(newGame().availableActions().length, 12);
  });
  it('marks a region action unaffordable until a region is chosen', () => {
    const g = newGame(); clearEvent(g);
    const without = g.availableActions().find(a => a.id === 'tv_ad_blitz');
    assert.equal(without.affordable, false);
    assert.match(without.reason, /region/i);
    const rid = g.getState().regions[0].id;
    const withRegion = g.availableActions(rid).find(a => a.id === 'tv_ad_blitz');
    assert.equal(withRegion.affordable, true);
  });
  it('TV ad cost scales with the region media multiplier and the insider discount', () => {
    const g = newGame({ candidateId: 'seasoned_insider' }); clearEvent(g);
    const cf = findRegion(g.getState(), r => r.abbreviation === 'CF'); // mediaCostMultiplier 2.0
    const a = g.availableActions(cf.id).find(x => x.id === 'tv_ad_blitz');
    assert.equal(a.costFunds, Math.round(150 * cf.mediaCostMultiplier)); // 150 insider base * 2.0
  });
});

describe('actions apply their effectSummary', () => {
  it('tv_ad_blitz raises target lean (>= +3 floor), adds buzz, spends AP+funds', () => {
    const g = newGame(); clearEvent(g);
    const before = g.getState();
    const r = findRegion(before, x => x.abbreviation === 'WI'); // tossup +2
    const ap0 = before.resources.actionPoints, funds0 = before.resources.funds, buzz0 = before.national.mediaBuzz;
    const res = g.doAction('tv_ad_blitz', r.id);
    const after = g.getState();
    const r2 = findRegion(after, x => x.id === r.id);
    assert.equal(res.ok, true);
    assert.ok(r2.lean - r.lean >= 3, 'lean rose by at least the +3 floor');
    assert.equal(after.resources.actionPoints, ap0 - 1);
    assert.ok(after.resources.funds < funds0);
    assert.equal(after.national.mediaBuzz, buzz0 + 3);
  });
  it('attack_ad wounds the opponent and nicks your own scandal', () => {
    const g = newGame(); clearEvent(g);
    const b = g.getState();
    const r = findRegion(b, x => Math.abs(x.lean) < 30);
    g.doAction('attack_ad', r.id);
    const a = g.getState();
    assert.equal(a.opponent.momentum, b.opponent.momentum - 6);
    assert.equal(a.opponent.scandalLevel, b.opponent.scandalLevel + 5);
    assert.equal(a.national.scandalLevel, b.national.scandalLevel + 3);
  });
  it('major_fundraiser nets at least the 150 floor and costs momentum', () => {
    const g = newGame(); clearEvent(g);
    const b = g.getState();
    g.doAction('major_fundraiser');
    const a = g.getState();
    assert.ok(a.resources.funds - b.resources.funds >= 150);
    assert.equal(a.national.momentum, b.national.momentum - 3);
  });
  it('damage_control lowers scandal (insider removes 26)', () => {
    const g = craft(st => { st.national.scandalLevel = 60; });
    g.doAction('damage_control');
    assert.equal(g.getState().national.scandalLevel, 60 - 26); // insider damageControlAmt
  });
  it('counter_messaging cuts opponent momentum', () => {
    const g = craft(st => { st.opponent.momentum = 20; });
    g.doAction('counter_messaging');
    assert.equal(g.getState().opponent.momentum, 20 - 12);
  });
  it('polling_consultant reveals intel and arms a one-shot +25% region bonus', () => {
    const g = newGame(); clearEvent(g);
    g.doAction('polling_consultant');
    const s = g.getState();
    assert.ok(s.intel && s.intel.active);
    assert.equal(s.nextRegionActionBonus, 0.25);
  });
});

describe('doAction() guards', () => {
  it('rejects an unknown action', () => {
    assert.equal(newGame().doAction('nope').ok, false);
  });
  it('requires a target for region actions', () => {
    const g = newGame(); clearEvent(g);
    assert.equal(g.doAction('tv_ad_blitz').ok, false);
  });
  it('is blocked while an event is pending', () => {
    const g = craft(st => { st.pendingEvent = { id: 'x', title: 'T', category: 'gaffe', description: 'd', choices: [{ id: 'c', label: 'l', effects: [] }] }; });
    assert.equal(g.doAction('major_fundraiser').ok, false);
    assert.equal(g.endTurn().ok, false);
  });
});

describe('undoLastAction()', () => {
  it('restores resources exactly and is cleared across the week boundary', () => {
    const g = newGame(); clearEvent(g);
    const before = g.getState();
    const r = findRegion(before, x => x.lean > 0 && x.lean < 35);
    g.doAction('tv_ad_blitz', r.id);
    assert.equal(g.undoLastAction().ok, true);
    const back = g.getState();
    assert.equal(back.resources.funds, before.resources.funds);
    assert.equal(back.resources.actionPoints, before.resources.actionPoints);
    g.doAction('tv_ad_blitz', r.id); g.endTurn();
    assert.equal(g.undoLastAction().ok, false);
  });
});

describe('events', () => {
  it('applies a choice\'s channel effects and clears the pending event', () => {
    const g = craft(st => {
      st.pendingEvent = { id: 'e', title: 'Donor flap', category: 'fundraising-controversy', description: 'd',
        choices: [{ id: 'take', label: 'Keep it', effects: [{ type: 'funds', value: 500 }, { type: 'scandalLevel', value: 10 }] }] };
    });
    const f0 = g.getState().resources.funds, sc0 = g.getState().national.scandalLevel;
    assert.equal(g.hasPendingEvent(), true);
    const out = g.resolveEvent('take');
    assert.equal(out.ok, true);
    assert.equal(g.hasPendingEvent(), false);
    assert.equal(g.getState().resources.funds, f0 + 500);
    assert.equal(g.getState().national.scandalLevel, sc0 + 10);
  });
  it('honors a regionLean selector (strongest region)', () => {
    const g = craft(st => {
      st.pendingEvent = { id: 'e2', title: 'Home crowd', category: 'gaffe', description: 'd',
        choices: [{ id: 'c', label: 'l', effects: [{ type: 'regionLean', value: -7, selector: 'strongest' }] }] };
    });
    const before = g.getState();
    const strongest = before.regions.slice().sort((a, b) => b.lean - a.lean)[0];
    g.resolveEvent('c');
    const after = findRegion(g.getState(), r => r.id === strongest.id);
    assert.ok(Math.abs(after.lean - (strongest.lean - 7)) < 1e-6);
  });
});

describe('endTurn() turn loop', () => {
  it('advances the week, refreshes AP to 5, and expires consultant intel/bonus', () => {
    const g = newGame(); clearEvent(g);
    g.doAction('polling_consultant'); // arms intel + 0.25 bonus, no region action
    const r = g.endTurn();
    assert.equal(r.ok, true);
    const s = g.getState();
    assert.equal(s.turn, 2);
    assert.equal(s.resources.actionPoints, 5);
    assert.equal(s.intel, null);
    assert.equal(s.nextRegionActionBonus, 0);
  });
});

describe('win / fail evaluation (checkEndConditions)', () => {
  it('returns null mid-game with no trigger', () => {
    assert.equal(craft(st => { st.turn = 5; }).checkEndConditions(), null);
  });
  it('win: electoral majority on election day', () => {
    const g = craft(st => { st.turn = 12; st.regions.forEach(r => { r.lean = 50; }); });
    const e = g.checkEndConditions();
    assert.equal(e.status, 'won');
    assert.equal(e.condition, 'win_electoral_majority');
  });
  it('fail: short of 270 on election day', () => {
    const g = craft(st => { st.turn = 12; st.regions.forEach(r => { r.lean = -50; }); });
    const e = g.checkEndConditions();
    assert.equal(e.status, 'lost');
    assert.equal(e.condition, 'fail_electoral_loss');
  });
  it('win: early clinch when safe EV >= 270 before election day', () => {
    const g = craft(st => { st.turn = 5; st.regions.slice(0, 5).forEach(r => { r.lean = 50; }); });
    assert.equal(g.checkEndConditions().condition, 'win_early_clinch');
  });
  it('win: opponent collapse (scandal >= 90 and momentum <= -40)', () => {
    const g = craft(st => { st.opponent.scandalLevel = 95; st.opponent.momentum = -50; });
    assert.equal(g.checkEndConditions().condition, 'win_opponent_collapse');
  });
  it('fail: scandal collapse at >= 80', () => {
    assert.equal(craft(st => { st.national.scandalLevel = 85; }).checkEndConditions().condition, 'fail_scandal_collapse');
  });
  it('fail: bankruptcy (broke AND no volunteers AND no momentum, before turn 12)', () => {
    const g = craft(st => { st.turn = 5; st.resources.funds = -10; st.resources.volunteers = 2; st.national.momentum = -5; });
    assert.equal(g.checkEndConditions().condition, 'fail_bankruptcy');
  });
  it('grace: broke alone (with volunteers or momentum) is NOT bankruptcy', () => {
    const g = craft(st => { st.turn = 5; st.resources.funds = -10; st.resources.volunteers = 8; st.national.momentum = 5; });
    assert.equal(g.checkEndConditions(), null);
  });
});

describe('determinism + save/load', () => {
  it('same seed + actions replays byte-identically', () => {
    function play() {
      const g = newGame({ candidateId: 'charismatic_outsider', seed: 'det' });
      for (let i = 0; i < 4; i++) { clearEvent(g); g.doAction('campaign_rally', g.getState().regions[4].id); g.endTurn(); }
      return g.save();
    }
    assert.equal(play(), play());
  });
  it('load(save()) then identical play stays byte-identical', () => {
    function drive(g, n) { for (let i = 0; i < n; i++) { clearEvent(g); g.doAction('major_fundraiser'); g.endTurn(); } }
    const a = newGame({ seed: 'sl' }); drive(a, 3);
    const b = Engine.load(a.save());
    drive(a, 3); drive(b, 3);
    assert.equal(a.save(), b.save());
  });
  it('rejects a malformed save', () => {
    assert.throws(() => Engine.load('{"x":1}'));
    assert.throws(() => Engine.load('not json'));
  });
  it('repairs a region missing baseLean instead of NaN-ing the map on upkeep', () => {
    // A tampered/old save can omit baseLean; upkeep does target = baseLean + ...,
    // which without a repair turns every region lean into NaN on the next week.
    const g = craft((st) => { delete st.regions[0].baseLean; });
    clearEvent(g);
    assert.ok(g.endTurn().ok, 'endTurn (which runs upkeep) should succeed');
    const leans = g.getState().regions.map((r) => r.lean);
    assert.ok(leans.every(Number.isFinite), 'all region leans stay finite after upkeep');
  });
  it('rejects a save whose region.lean / electoralVotes is non-finite', () => {
    const bad1 = JSON.parse(newGame().save()); bad1.state.regions[0].lean = null;
    const bad2 = JSON.parse(newGame().save()); bad2.state.regions[0].electoralVotes = 'x';
    assert.throws(() => Engine.load(JSON.stringify(bad1)), /malformed|unrecognized/i);
    assert.throws(() => Engine.load(JSON.stringify(bad2)), /malformed|unrecognized/i);
  });
});

describe('tally()', () => {
  it('band display tally and decisive by-sign tally both total 538', () => {
    const t = newGame().tally();
    assert.equal(t.playerEV + t.oppEV + t.tossupEV, 538);
    assert.equal(t.decisive.playerEV + t.decisive.oppEV, 538);
    assert.equal(t.votesToWin, 270);
  });
});
