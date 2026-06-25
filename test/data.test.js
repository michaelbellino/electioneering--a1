/* Data spec invariants — node:test (no dependencies). */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Data = require(path.join(__dirname, '..', 'src', 'data.js'));

const CHANNELS = ['funds', 'momentum', 'nationalApproval', 'scandalLevel', 'mediaBuzz',
  'volunteers', 'actionPoints', 'regionLean', 'opponentMomentum', 'opponentScandal'];
const SELECTORS = ['all', 'strongest', 'weakest', 'random', 'mostVotes', 'none'];

describe('Data.regions', () => {
  it('has 18 regions whose electoral votes sum to 538', () => {
    assert.equal(Data.regions.length, 18);
    assert.equal(Data.regions.reduce((a, r) => a + r.electoralVotes, 0), 538);
  });
  it('every region has the fields the engine relies on', () => {
    Data.regions.forEach(r => {
      assert.equal(typeof r.id, 'string');
      assert.equal(typeof r.electoralVotes, 'number');
      assert.equal(typeof r.initialLean, 'number');
      assert.equal(typeof r.mediaCostMultiplier, 'number');
      assert.equal(typeof r.volatility, 'number');
    });
  });
});

describe('Data.design', () => {
  it('defines 12 actions with costs + targeting', () => {
    assert.equal(Data.design.actions.length, 12);
    Data.design.actions.forEach(a => {
      assert.equal(typeof a.id, 'string');
      assert.equal(typeof a.costActionPoints, 'number');
      assert.ok(a.targeting === 'region' || a.targeting === 'national');
    });
  });
  it('uses the canonical balance constants', () => {
    const b = Data.design.balance;
    assert.equal(b.totalElectoralVotes, 538);
    assert.equal(b.electoralVotesToWin, 270);
    assert.equal(b.scandalLossThreshold, 80);
    assert.equal(Data.design.turnStructure.totalTurns, 12);
    assert.equal(Data.design.turnStructure.actionPointsPerTurn, 5);
  });
  it('declares 3 win and 3 fail conditions', () => {
    assert.equal(Data.design.winConditions.length, 3);
    assert.equal(Data.design.failConditions.length, 3);
  });
});

describe('Data.candidates', () => {
  it('has 3 candidates each with starting modifiers', () => {
    assert.equal(Data.candidates.length, 3);
    Data.candidates.forEach(c => assert.equal(typeof c.startingModifiers, 'string'));
  });
});

describe('Data.events', () => {
  it('has 34 events, each with 2-3 choices', () => {
    assert.equal(Data.events.length, 34);
    Data.events.forEach(e => {
      assert.ok(e.choices.length >= 2 && e.choices.length <= 3, e.id + ' choice count');
    });
  });
  it('only uses known effect channels and selectors', () => {
    Data.events.forEach(e => e.choices.forEach(c => (c.effects || []).forEach(eff => {
      assert.ok(CHANNELS.indexOf(eff.type) !== -1, 'unknown channel ' + eff.type + ' in ' + e.id);
      if (eff.selector) assert.ok(SELECTORS.indexOf(eff.selector) !== -1, 'unknown selector ' + eff.selector + ' in ' + e.id);
      assert.equal(typeof eff.value, 'number');
    })));
  });
});
