/*
 * Campaign Trail — bootstrap + screen flow (src/main.js)
 *
 * Owns the engine instance, the start -> dashboard -> end screen flow, the
 * dynamic-event modal, localStorage persistence, and the per-week series the
 * KPI sparklines/deltas read from. All game rules live in the engine; all
 * rendering lives in Campaign.UI. This file is the glue between them.
 */
(function () {
  'use strict';

  var C = window.Campaign;
  if (!C || !C.Engine || !C.UI) { console.error('Campaign Trail failed to load its modules.'); return; }
  var Engine = C.Engine, Data = C.Data, UI = C.UI, Charts = C.Charts, MapView = C.MapView, Util = C.Util;

  var SAVE_KEY = 'campaign-trail:save:v1';
  var root = document.getElementById('app');
  var deps = { Charts: Charts, MapView: MapView, Util: Util, Data: Data, Engine: Engine };

  var app = {
    engine: null,
    dashboard: null,
    selectedRegionId: null,
    series: {},          // statKey -> [value per recorded week]
    kpiBaseline: {},     // stat values at the start of the current week (delta basis)
    eventOpen: false,
    ended: false
  };

  /* ---------------- persistence ---------------- */
  function safeLS(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function hasSave() { return safeLS(function () { return !!localStorage.getItem(SAVE_KEY); }, false); }
  function saveGame() { return safeLS(function () { localStorage.setItem(SAVE_KEY, app.engine.save()); return true; }, false); }
  function loadSave() { return safeLS(function () { var s = localStorage.getItem(SAVE_KEY); return s ? Engine.load(s) : null; }, null); }
  function clearSave() { safeLS(function () { localStorage.removeItem(SAVE_KEY); return true; }, false); }
  function autosave() { if (app.engine && !app.ended) saveGame(); }

  /* ---------------- stat snapshots / series ---------------- */
  function snapshotStats(s) {
    return {
      funds: s.resources.funds,
      actionPoints: s.resources.actionPoints,
      volunteers: s.resources.volunteers,
      momentum: s.national.momentum,
      nationalApproval: s.national.nationalApproval,
      scandalLevel: s.national.scandalLevel
    };
  }
  function recordSeries(s) {
    var snap = snapshotStats(s);
    Object.keys(snap).forEach(function (k) { (app.series[k] = app.series[k] || []).push(Math.round(snap[k] * 10) / 10); });
  }
  function computeDeltas(s) {
    var cur = snapshotStats(s), d = {};
    Object.keys(cur).forEach(function (k) { d[k] = cur[k] - (app.kpiBaseline[k] || 0); });
    return d;
  }

  /* ---------------- view model ---------------- */
  function buildVM(state) {
    return {
      state: state,
      tally: state.tally,
      actions: app.engine.availableActions(app.selectedRegionId),
      selectedRegionId: app.selectedRegionId,
      series: app.series,
      deltas: computeDeltas(state),
      deps: deps
    };
  }

  /* ---------------- screen flow ---------------- */
  function showStart() {
    if (app.dashboard && app.dashboard.destroy) app.dashboard.destroy();
    app.engine = null; app.dashboard = null; app.eventOpen = false; app.ended = false;
    app.selectedRegionId = null; app.series = {}; app.kpiBaseline = {};
    var diffBlurbs = {
      easy: 'Forgiving. The rival pulls its punches and you start with an edge.',
      normal: 'Balanced. Winnable with focus, losable if you coast.',
      hard: 'Relentless. The rival spends more, hits harder, and starts ahead in four big states.'
    };
    var difficulties = (Data.design.opponentAI.difficultyModifiers || []).map(function (d) {
      return { level: d.level, blurb: diffBlurbs[d.level] || d.description };
    });
    UI.renderStart(root, {
      candidates: Data.candidates,
      difficulties: difficulties,
      tutorialBeats: Data.design.tutorialBeats,
      hasSave: hasSave()
    }, {
      onStart: function (candidateId, difficulty) { newGame(candidateId, difficulty); },
      onContinue: function () {
        var g = loadSave();
        if (g) { attach(g); } else { UI.toast('No saved campaign found.', 'bad'); }
      }
    });
  }

  function newGame(candidateId, difficulty) {
    var seed = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    attach(Engine.create({ seed: seed, candidateId: candidateId, difficulty: difficulty }));
  }

  function attach(engineInstance) {
    app.engine = engineInstance;
    app.ended = false;
    app.eventOpen = false;
    app.selectedRegionId = null;
    app.series = {};
    var st = app.engine.getState();
    recordSeries(st);                         // week-1 starting sample
    app.kpiBaseline = snapshotStats(st);
    if (app.dashboard && app.dashboard.destroy) app.dashboard.destroy(); // tear down any prior MapView controller
    app.dashboard = UI.createDashboard({ root: root, deps: deps, callbacks: callbacks });
    refresh();
    UI.announce('Campaign started. Week 1 of 12.');
  }

  var callbacks = {
    onSelectRegion: function (id) {
      app.selectedRegionId = (app.selectedRegionId === id) ? null : id; // toggle to deselect
      refresh();
    },
    onAction: function (actionId) { doAction(actionId); },
    onEndWeek: function () { endWeek(); },
    onUndo: function () {
      var r = app.engine.undoLastAction();
      if (r.ok) { autosave(); UI.toast('Undid last action.'); refresh(); }
      else UI.toast(r.error || 'Nothing to undo.', 'bad');
    },
    onSave: function () { var ok = saveGame(); UI.toast(ok ? 'Campaign saved.' : 'Could not save (storage blocked).', ok ? 'good' : 'bad'); },
    onNewGame: function () {
      if (window.confirm('Abandon this campaign and start a new one?')) { clearSave(); showStart(); }
    },
    onFundraise: function (opts) {
      var r = app.engine.fundraise(opts);
      if (!r.ok) { UI.toast(r.error || 'Cannot fundraise right now.', 'bad'); return; }
      autosave(); refresh();
      var res = r.result;
      UI.toast('Raised $' + res.yield + 'k' + (res.scandal ? ' · +' + res.scandal + ' scandal' : '') + (res.favors ? ' · favor owed' : ''), res.scandal ? 'neutral' : 'good');
    },
    onRally: function (opts) {
      var r = app.engine.rally(opts);
      if (!r.ok) { UI.toast(r.error || 'Cannot rally right now.', 'bad'); return; }
      autosave(); refresh();
      var res = r.result;
      UI.toast('Rally: +' + res.momentum + ' momentum' + (res.gaffe ? ' · a gaffe!' : ''), res.gaffe ? 'bad' : 'good');
    }
  };

  function doAction(actionId) {
    var r = app.engine.doAction(actionId, app.selectedRegionId);
    if (!r.ok) { UI.toast(r.error || 'Cannot do that right now.', 'bad'); return; }
    autosave();
    refresh();
    var res = r.result || {};
    if (res.viral) UI.toast('Your rally went viral — double impact!', 'good');
    if (res.gaffe) UI.toast('A gaffe on the trail nudged your scandal up.', 'bad');
    if (res.success === false) UI.toast('Opposition research backfired!', 'bad');
  }

  function endWeek() {
    if (app.engine.hasPendingEvent()) { showEvent(); return; }
    recordSeries(app.engine.getState());      // end-of-week sample for the trend
    var r = app.engine.endTurn();
    if (!r.ok) { UI.toast(r.error || 'Cannot end the week.', 'bad'); return; }
    var st = app.engine.getState();
    app.kpiBaseline = snapshotStats(st);       // new week baseline (post-upkeep)
    var sum = r.summary || {};
    if (sum.opponent) UI.toast(sum.opponent);
    refresh();                                 // shows end screen if the game is over
    if (st.status === 'playing' && app.engine.hasPendingEvent()) showEvent();
  }

  function refresh() {
    if (!app.engine) return;
    var st = app.engine.getState();
    if (st.status !== 'playing') { showEnd(st); return; }
    app.dashboard.update(buildVM(st));
    if (app.engine.hasPendingEvent() && !app.eventOpen) showEvent();
  }

  function showEvent() {
    if (app.eventOpen || !app.engine.hasPendingEvent()) return;
    app.eventOpen = true;
    var ev = app.engine.getPendingEvent();
    UI.showEventModal(root, {
      event: ev,
      onChoose: function (choiceId) {
        var r = app.engine.resolveEvent(choiceId);
        app.eventOpen = false;
        if (!r.ok) { UI.toast(r.error || 'Could not resolve event.', 'bad'); return; }
        autosave();
        var headline = summarizeApplied(r.applied);
        if (headline) UI.toast(headline);
        refresh();
      }
    });
  }

  function summarizeApplied(applied) {
    if (!applied || !applied.length) return '';
    var notable = applied.filter(function (a) { return Math.abs(a.value) >= (a.type === 'funds' ? 100 : 5); });
    if (!notable.length) return '';
    var first = notable[0];
    var fx = UI.effectText(first);
    return 'Event resolved: ' + fx.text + (notable.length > 1 ? ' and more.' : '.');
  }

  function showEnd(state) {
    if (app.ended) return;
    app.ended = true;
    clearSave();                               // a finished game shouldn't be "continued"
    var vm = buildVM(state);
    if (app.dashboard && app.dashboard.destroy) app.dashboard.destroy(); // tear down the MapView before swapping screens
    UI.renderEndScreen(root, vm, { onReplay: function () { showStart(); } });
  }

  /* ---------------- theme (bright default, dark optional, persisted) ---------------- */
  var THEME_KEY = 'campaign-trail:theme:v1';
  function applyTheme(mode) {
    var dark = mode === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to bright mode' : 'Switch to dark mode');
      var label = btn.querySelector('.theme-toggle__label');
      var ic = btn.querySelector('.theme-toggle__icon');
      if (label) label.textContent = dark ? 'Bright' : 'Dark';
      if (ic) ic.textContent = dark ? '◑' : '◐';
    }
  }
  function initTheme() {
    var saved = safeLS(function () { return localStorage.getItem(THEME_KEY); }, null);
    applyTheme(saved === 'dark' ? 'dark' : 'light');   // bright is the default
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next);
      safeLS(function () { localStorage.setItem(THEME_KEY, next); return true; }, false);
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    // Expose a small debug handle (no effect on gameplay).
    window.CampaignApp = app;
    initTheme();
    if (hasSave()) {
      // Offer resume from the start screen (the "Continue" button), but boot to start.
      showStart();
    } else {
      showStart();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
