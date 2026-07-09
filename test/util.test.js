/* Util unit tests — node:test (no dependencies). */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Util = require(path.join(__dirname, '..', 'src', 'util.js'));

describe('Util.clamp', () => {
  it('bounds within [lo, hi]', () => {
    assert.equal(Util.clamp(5, 0, 10), 5);
    assert.equal(Util.clamp(-3, 0, 10), 0);
    assert.equal(Util.clamp(99, 0, 10), 10);
  });
});

describe('Util.formatMoney', () => {
  it('compacts thousands/millions/billions', () => {
    assert.equal(Util.formatMoney(1500), '1.5K');
    assert.equal(Util.formatMoney(2_500_000), '2.5M');   // 1 decimal below 10M
    assert.equal(Util.formatMoney(12_345_678), '12M');   // decimal dropped at >= 10M
    assert.equal(Util.formatMoney(0), '0');
    assert.equal(Util.formatMoney(-2000), '-2K');
  });
});

describe('Util.formatSigned', () => {
  it('prefixes a + on non-negative values', () => {
    assert.equal(Util.formatSigned(4), '+4');
    assert.equal(Util.formatSigned(-4), '-4');
    assert.equal(Util.formatSigned(0), '0');   // sign prefix only for positive values
  });
});

describe('Util.leanLabel / leanClass', () => {
  it('labels tossups and leans by magnitude and side', () => {
    assert.equal(Util.leanLabel(0), 'Tossup');
    assert.match(Util.leanLabel(40), /Safe You/);
    assert.match(Util.leanLabel(-40), /Safe Opp/);
  });
  it('maps lean to the 5-stop contract state classes', () => {
    assert.equal(Util.leanClass(50), 'is-player');
    assert.equal(Util.leanClass(10), 'is-leanplayer');
    assert.equal(Util.leanClass(0), 'is-tossup');
    assert.equal(Util.leanClass(-10), 'is-leanopp');
    assert.equal(Util.leanClass(-50), 'is-opponent');
  });
});
