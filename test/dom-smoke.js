/*
 * Campaign Trail — headless DOM smoke test (jsdom).
 *
 *   npm run test:dom    (or: node test/dom-smoke.js)
 *
 * Loads index.html + every game script into a jsdom window exactly as the
 * browser would, then drives a FULL game through the rendered UI — start
 * screen -> launch -> play every week (resolving event modals, selecting
 * regions, spending actions) -> end screen -> replay — asserting the screens
 * render and NO runtime error is thrown anywhere in ui.js / main.js / the
 * engine / the chart + map render layers.
 *
 * Requires the `jsdom` devDependency (npm install).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var jsdomMod;
try { jsdomMod = require('jsdom'); }
catch (e) { console.error('dom-smoke needs jsdom: run `npm install` first.'); process.exit(2); }
var JSDOM = jsdomMod.JSDOM, VirtualConsole = jsdomMod.VirtualConsole;

var vc = new VirtualConsole();
var pageErrors = [];
vc.on('jsdomError', function (e) { pageErrors.push(e.message); });

var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc });
var window = dom.window;
window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(Date.now()); }, 0); };
window.cancelAnimationFrame = function (id) { clearTimeout(id); };
window.confirm = function () { return true; };

var errors = [];
window.addEventListener('error', function (e) { errors.push('window: ' + (e.error && e.error.stack || e.message)); });

['src/rng.js', 'src/util.js', 'src/charts.js', 'src/map.js', 'src/data.js', 'src/engine.js', 'src/ui.js', 'src/main.js']
  .forEach(function (f) {
    try { window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
    catch (e) { errors.push('load ' + f + ': ' + e.stack); }
  });
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

function $(s) { return window.document.querySelector(s); }
function $all(s) { return Array.prototype.slice.call(window.document.querySelectorAll(s)); }
function click(n) { if (!n) throw new Error('tried to click a missing element'); n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

var checks = [];
function check(cond, msg) { checks.push({ ok: !!cond, msg: msg }); if (!cond) errors.push('assert: ' + msg); }

var outcome = 'NONE', weeks = 0, maxSparks = 0;
try {
  check($('.screen--start'), 'start screen renders');
  check($all('.candidate-card').length === 3, 'three candidate cards');
  check($all('.difficulty-pill').length === 3, 'three difficulty pills');
  check($all('.tutorial-beats li').length >= 5, 'tutorial beats render');

  click($all('.candidate-card')[0]);
  click($all('.difficulty-pill')[1]);   // normal
  click($('.start-actions .btn--accent'));

  check($('.app'), 'dashboard renders after launch');
  check($all('.kpi-card').length === 6, 'six KPI cards');
  check($all('.action-card').length === 12, 'twelve action cards');
  check($all('.region-tile').length === 18, 'eighteen map tiles');
  check($all('.chart svg').length >= 1, 'polling chart renders');
  check($all('.ec-bar__player').length >= 1, 'electoral-vote bar renders');

  var guard = 0;
  while (!$('.screen--win') && !$('.screen--lose') && guard++ < 90) {
    var ev = $('.modal .event-choice');
    if (ev) { click(ev); continue; }
    var tiles = $all('.region-tile');
    if (tiles.length) click(tiles[Math.floor(tiles.length / 2)]);
    var acts = $all('.action-card:not(.is-disabled)');
    if (acts.length) click(acts[0]);
    maxSparks = Math.max(maxSparks, $all('.kpi-card__spark svg').length);
    click($all('.topbar__controls .btn--accent')[0]);
    weeks++;
  }
  outcome = $('.screen--win') ? 'WIN' : $('.screen--lose') ? 'LOSE' : 'NONE';
  check(outcome !== 'NONE', 'game reaches an end screen');
  check($all('.recap-cell').length >= 4, 'end screen shows a recap');
  check(maxSparks >= 1, 'KPI sparklines render once a trend exists');

  click($('.screen .btn--accent'));     // play again
  check($('.screen--start'), 'replay returns to the start screen');
} catch (e) { errors.push('flow: ' + e.stack); }

var passed = checks.filter(function (c) { return c.ok; }).length;
checks.forEach(function (c) { console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.msg); });
console.log('\noutcome=' + outcome + ' weeks=' + weeks + ' | ' + passed + '/' + checks.length + ' checks');
if (pageErrors.length) { console.log('\nPAGE ERRORS:'); pageErrors.slice(0, 6).forEach(function (e) { console.log(' - ' + e.split('\n')[0]); }); }
if (errors.length) {
  console.log('\n*** RUNTIME ERRORS ***');
  errors.slice(0, 10).forEach(function (e) { console.log(' - ' + e.split('\n').slice(0, 3).join(' | ')); });
  process.exit(1);
}
console.log('\nDOM smoke: PASS — full game start -> ' + outcome + ' -> replay with no runtime errors.');
process.exit(0);
