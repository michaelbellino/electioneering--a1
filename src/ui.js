/*
 * Campaign Trail — UI rendering layer (Campaign.UI)
 *
 * A THIN renderer. It owns no game rules: it renders engine state into the DOM
 * (using ONLY the class contract in assets/css/styles.css) and reports user
 * intent back through callbacks. src/main.js owns the engine, the screen flow,
 * and persistence; this module just paints and wires events.
 *
 * UMD: browser global window.Campaign.UI. (Not used under Node — it touches the
 * DOM — but the wrapper stays consistent with the other modules.)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else { root.Campaign = root.Campaign || {}; root.Campaign.UI = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===================================================================== *
   * Tiny DOM helpers
   * ===================================================================== */
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      });
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function setText(node, text) { if (node) node.textContent = text; }

  /* ===================================================================== *
   * Inline SVG icons (no emoji; inherit currentColor)
   * ===================================================================== */
  var ICON_PATHS = {
    funds: '<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.2 12 9.8s5 1.3 5 3.2-2.2 3-5 3-5-1.1-5-3"/>',
    ap: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
    volunteers: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 14.5c2.5.2 4.5 2.3 4.5 5"/>',
    momentum: '<path d="M3 17l6-6 4 4 7-8M14 7h6v6"/>',
    approval: '<path d="M4 12.5 9 17l11-11"/>',
    scandal: '<path d="M12 3 2.5 20h19zM12 10v5M12 18h.01"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    opponent: '<path d="M5 21V4M5 4c3-2 6 2 9 0s5-1 5-1v9s-2 1-5 0-6-2-9 0"/>',
    log: '<path d="M5 4h14M5 9h14M5 14h10M5 19h7"/>',
    save: '<path d="M5 3h12l4 4v14H5zM8 3v6h8M8 21v-6h8v6"/>',
    undo: '<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/>',
    star: '<path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.7 1.2-6.1L3.3 9.4l6.1-.8z"/>',
    flag: '<path d="M5 21V4M5 5h14l-3 4 3 4H5"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };
  function icon(name, size) {
    var s = size || 18;
    var span = document.createElement('span');
    span.className = 'icon';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON_PATHS[name] || '') + '</svg>';
    return span;
  }

  /* ===================================================================== *
   * Channel labels + effect previews (events, action hints)
   * ===================================================================== */
  var CHANNEL = {
    funds: { label: 'Funds', goodWhenPositive: true, money: true },
    momentum: { label: 'Momentum', goodWhenPositive: true },
    nationalApproval: { label: 'Approval', goodWhenPositive: true },
    scandalLevel: { label: 'Scandal', goodWhenPositive: false },
    mediaBuzz: { label: 'Media Buzz', goodWhenPositive: true },
    volunteers: { label: 'Volunteers', goodWhenPositive: true },
    actionPoints: { label: 'Action Pts', goodWhenPositive: true },
    regionLean: { label: 'Region Lean', goodWhenPositive: true },
    opponentMomentum: { label: 'Opp. Momentum', goodWhenPositive: false },
    opponentScandal: { label: 'Opp. Scandal', goodWhenPositive: true }
  };
  var SELECTOR_LABEL = {
    all: 'every region', strongest: 'your strongest region', weakest: 'your weakest region',
    mostVotes: 'the biggest prize', random: 'a random region', none: ''
  };
  function effectText(eff) {
    var meta = CHANNEL[eff.type] || { label: eff.type, goodWhenPositive: true };
    var v = eff.value;
    var num = (v > 0 ? '+' : '') + (meta.money ? v : Math.round(v * 10) / 10);
    var sel = eff.type === 'regionLean' && eff.selector && SELECTOR_LABEL[eff.selector] ? ' (' + SELECTOR_LABEL[eff.selector] + ')' : '';
    var good = meta.goodWhenPositive ? v > 0 : v < 0;
    return { text: num + ' ' + meta.label + sel, good: good, neutral: v === 0 };
  }

  /* ===================================================================== *
   * Toasts + screen-reader announcements
   * ===================================================================== */
  function announce(msg) {
    var host = document.getElementById('sr-status');
    if (host) { host.textContent = ''; setTimeout(function () { host.textContent = msg; }, 30); }
  }
  function toast(msg, kind) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var t = h('div', { class: 'toast' + (kind ? ' is-' + kind : ''), role: 'status' }, msg);
    host.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  /* ===================================================================== *
   * START SCREEN
   * ===================================================================== */
  function renderStart(rootEl, vm, cb) {
    clear(rootEl);
    var selectedCandidate = vm.candidates[0].id;
    var selectedDifficulty = 'normal';

    var candidateCards = vm.candidates.map(function (c) {
      var attrs = c.attributes || {};
      var bars = Object.keys(attrs).map(function (k) {
        return h('div', { class: 'cand-attr' }, [
          h('span', { class: 'cand-attr__name' }, k),
          h('span', { class: 'meter', role: 'img', 'aria-label': k + ' ' + attrs[k] + ' of 100' }, [
            h('span', { class: 'meter__track' }, [
              h('span', { class: 'meter__fill ' + (attrs[k] >= 66 ? 'is-good' : attrs[k] >= 40 ? 'is-warn' : 'is-bad'), style: 'width:' + attrs[k] + '%' })
            ])
          ])
        ]);
      });
      var card = h('button', {
        class: 'candidate-card' + (c.id === selectedCandidate ? ' is-selected' : ''),
        type: 'button', 'data-id': c.id, 'aria-pressed': c.id === selectedCandidate ? 'true' : 'false'
      }, [
        h('div', { class: 'candidate-card__head' }, [
          h('span', { class: 'candidate-dot', style: 'background:' + (c.color || '#3B82F6'), 'aria-hidden': 'true' }),
          h('h3', null, c.name)
        ]),
        h('p', { class: 'candidate-card__party' }, c.party + ' · ' + (c.archetype || '')),
        h('p', { class: 'candidate-card__bio' }, c.bio || ''),
        h('div', { class: 'cand-attrs' }, bars),
        h('p', { class: 'candidate-card__mods' }, c.startingModifiers || '')
      ]);
      card.addEventListener('click', function () {
        selectedCandidate = c.id;
        rootEl.querySelectorAll('.candidate-card').forEach(function (n) {
          var on = n.getAttribute('data-id') === c.id;
          n.classList.toggle('is-selected', on);
          n.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
      return card;
    });

    var diffPills = vm.difficulties.map(function (d) {
      var pill = h('button', {
        class: 'difficulty-pill' + (d.level === selectedDifficulty ? ' is-active' : ''),
        type: 'button', 'data-level': d.level, 'aria-pressed': d.level === selectedDifficulty ? 'true' : 'false'
      }, [h('strong', null, d.level.charAt(0).toUpperCase() + d.level.slice(1)), h('span', { class: 'difficulty-pill__desc' }, d.blurb)]);
      pill.addEventListener('click', function () {
        selectedDifficulty = d.level;
        rootEl.querySelectorAll('.difficulty-pill').forEach(function (n) {
          var on = n.getAttribute('data-level') === d.level;
          n.classList.toggle('is-active', on);
          n.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
      return pill;
    });

    var beats = h('ul', { class: 'tutorial-beats' }, vm.tutorialBeats.map(function (b, i) {
      return h('li', null, [h('span', { class: 'beat-num', 'aria-hidden': 'true' }, String(i + 1)), h('span', null, b)]);
    }));

    var screen = h('div', { class: 'screen screen--start' }, [
      h('div', { class: 'screen__hero' }, [
        h('span', { class: 'brand-star', 'aria-hidden': 'true' }),
        h('h1', null, 'Campaign Trail'),
        h('p', { class: 'screen__tagline' }, 'Road to 270 — twelve weeks, eighteen regions, 538 electoral votes. Out-campaign a reactive rival and clinch the presidency.')
      ]),
      vm.hasSave ? h('div', { class: 'resume-row' }, [
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: function () { cb.onContinue(); } }, [icon('play'), 'Continue saved campaign']),
        h('span', { class: 'resume-hint' }, 'or start fresh below')
      ]) : null,
      h('section', { class: 'start-section' }, [
        h('h2', { class: 'start-section__title' }, 'Choose your candidate'),
        h('div', { class: 'candidate-grid' }, candidateCards)
      ]),
      h('section', { class: 'start-section' }, [
        h('h2', { class: 'start-section__title' }, 'Difficulty'),
        h('div', { class: 'difficulty-row' }, diffPills)
      ]),
      h('section', { class: 'start-section' }, [
        h('h2', { class: 'start-section__title' }, 'How to win'),
        beats
      ]),
      h('div', { class: 'start-actions' }, [
        h('button', { class: 'btn btn--accent btn--block', type: 'button', onclick: function () { cb.onStart(selectedCandidate, selectedDifficulty); } }, [icon('play'), 'Launch campaign'])
      ])
    ]);
    rootEl.appendChild(screen);
    var firstCard = rootEl.querySelector('.candidate-card');
    if (firstCard) firstCard.focus();
  }

  /* ===================================================================== *
   * DASHBOARD view-controller
   *   createDashboard({root, deps, callbacks}) -> { update(vm), destroy() }
   * ===================================================================== */
  function createDashboard(cfg) {
    var root = cfg.root, deps = cfg.deps, cbk = cfg.callbacks;
    var Charts = deps.Charts, MapView = deps.MapView, Util = deps.Util;
    clear(root);

    var refs = {};
    var mapController = null;
    var built = false;

    var KPI_DEFS = [
      { key: 'funds', icon: 'funds', label: 'War Chest', fmt: function (s) { return Util.formatMoney(s.resources.funds * 1000); }, val: function (s) { return s.resources.funds; }, color: 'var(--color-accent)', money: true },
      { key: 'actionPoints', icon: 'ap', label: 'Action Pts', fmt: function (s) { return s.resources.actionPoints + ' / 5'; }, val: function (s) { return s.resources.actionPoints; }, color: 'var(--color-primary-bright)' },
      { key: 'volunteers', icon: 'volunteers', label: 'Volunteers', fmt: function (s) { return (Math.round(s.resources.volunteers * 10) / 10) + 'k'; }, val: function (s) { return s.resources.volunteers; }, color: 'var(--color-good)' },
      { key: 'momentum', icon: 'momentum', label: 'Momentum', fmt: function (s) { return Util.formatSigned(s.national.momentum); }, val: function (s) { return s.national.momentum; }, color: 'var(--color-primary-bright)' },
      { key: 'nationalApproval', icon: 'approval', label: 'Approval', fmt: function (s) { return Util.formatSigned(s.national.nationalApproval); }, val: function (s) { return s.national.nationalApproval; }, color: 'var(--color-info)' },
      { key: 'scandalLevel', icon: 'scandal', label: 'Scandal', fmt: function (s) { return Math.round(s.national.scandalLevel) + ' / 80'; }, val: function (s) { return s.national.scandalLevel; }, color: 'var(--color-bad)', invert: true }
    ];

    function build(vm) {
      // ---- header / topbar ----
      var endBtn = h('button', { class: 'btn btn--accent', type: 'button', onclick: function () { cbk.onEndWeek(); } }, [icon('refresh'), h('span', null, 'End Week')]);
      var undoBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { cbk.onUndo(); }, 'aria-label': 'Undo last action' }, [icon('undo'), h('span', { class: 'btn-label' }, 'Undo')]);
      var saveBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { cbk.onSave(); }, 'aria-label': 'Save campaign' }, [icon('save'), h('span', { class: 'btn-label' }, 'Save')]);
      var newBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { cbk.onNewGame(); }, 'aria-label': 'Abandon and start a new campaign' }, ['New']);
      refs.endBtn = endBtn; refs.undoBtn = undoBtn;

      var header = h('header', { class: 'app__header' }, [
        h('div', { class: 'topbar' }, [
          h('div', { class: 'topbar__brand' }, 'Campaign Trail'),
          refs.evSummary = h('div', { class: 'topbar__score', 'aria-live': 'polite' }),
          h('div', { class: 'topbar__turn' }, [refs.turnLabel = h('span', null, 'WEEK '), refs.turnNum = h('strong', null, '1'), h('span', null, ' / 12')]),
          h('div', { class: 'topbar__controls' }, [undoBtn, saveBtn, newBtn, endBtn])
        ])
      ]);

      // ---- sidebar: region detail + action panel ----
      refs.regionPanelBody = h('div', { class: 'panel__body' });
      var regionPanel = h('section', { class: 'panel' }, [h('div', { class: 'panel__title' }, [icon('map'), h('span', null, 'Region')]), refs.regionPanelBody]);

      refs.actionList = h('div', { class: 'panel__body action-list' });
      var actionPanel = h('section', { class: 'panel' }, [
        h('div', { class: 'panel__title' }, [icon('ap'), h('span', null, 'Campaign Actions')]),
        refs.actionList
      ]);
      var sidebar = h('aside', { class: 'app__sidebar' }, [regionPanel, actionPanel]);

      // ---- center: KPI bar + map + ev-bar + polling chart ----
      refs.kpiCards = {};
      var kpiBar = h('div', { class: 'kpi-bar' }, KPI_DEFS.map(function (def) {
        var spark = h('div', { class: 'kpi-card__spark' });
        var value = h('div', { class: 'kpi-card__value' }, '—');
        var delta = h('div', { class: 'kpi-card__delta is-flat' });
        refs.kpiCards[def.key] = { value: value, delta: delta, spark: spark };
        return h('div', { class: 'kpi-card', 'data-kpi': def.key }, [
          h('div', { class: 'kpi-card__label' }, [icon(def.icon, 14), h('span', null, def.label)]),
          value, delta, spark
        ]);
      }));

      refs.mapMount = h('div', { class: 'map__svg' });
      refs.legend = h('div', { class: 'map-legend' }, [
        legendItem('is-player', 'Safe You'), legendItem('is-leanplayer', 'Lean You'),
        legendItem('is-tossup', 'Tossup'), legendItem('is-leanopp', 'Lean Opp'), legendItem('is-opponent', 'Safe Opp')
      ]);
      refs.ecBar = h('div', { class: 'ec-bar', role: 'img', 'aria-label': 'Electoral vote projection' }, [
        refs.ecPlayer = h('div', { class: 'ec-bar__player' }),
        refs.ecUndecided = h('div', { class: 'ec-bar__undecided' }),
        refs.ecOpp = h('div', { class: 'ec-bar__opp' }),
        refs.ecNeedle = h('div', { class: 'ec-bar__needle', style: 'left:50.2%' })
      ]);
      var mapPanel = h('section', { class: 'panel map' }, [
        h('div', { class: 'panel__title' }, [icon('map'), h('span', null, 'Electoral Map'), refs.mapHint = h('span', { class: 'panel__hint' }, '538 EV · 270 to win')]),
        h('div', { class: 'panel__body' }, [refs.mapMount, refs.legend, h('div', { class: 'ec-bar-wrap' }, [refs.ecBar])])
      ]);

      refs.chartMount = h('div', { class: 'chart' });
      var chartPanel = h('section', { class: 'panel' }, [
        h('div', { class: 'panel__title' }, [icon('chart'), h('span', null, 'Polling Trend')]),
        h('div', { class: 'panel__body' }, [refs.chartMount])
      ]);

      var center = h('main', { class: 'app__center', id: 'main-content', tabindex: '-1' }, [kpiBar, mapPanel, chartPanel]);

      // ---- right rail: opponent watch + intel + log ----
      refs.oppBody = h('div', { class: 'panel__body' });
      var oppPanel = h('section', { class: 'panel' }, [h('div', { class: 'panel__title' }, [icon('opponent'), h('span', null, 'Opponent War Room')]), refs.oppBody]);
      refs.logBody = h('div', { class: 'panel__body log' });
      var logPanel = h('section', { class: 'panel' }, [h('div', { class: 'panel__title' }, [icon('log'), h('span', null, 'Campaign Log')]), refs.logBody]);
      var rail = h('aside', { class: 'app__rightrail' }, [oppPanel, logPanel]);

      var appEl = h('div', { class: 'app' }, [header, h('div', { class: 'app__main' }, [sidebar, center, rail])]);
      root.appendChild(appEl);

      // ---- map controller (created once) ----
      mapController = MapView.create(refs.mapMount, {
        regions: vm.state.regions,
        ariaLabel: 'Electoral cartogram — select a region to target actions',
        onSelect: function (r) { cbk.onSelectRegion(r && r.id != null ? r.id : r); }
      });
      built = true;
    }

    function legendItem(cls, label) {
      return h('span', { class: 'map-legend__item ' + cls }, label);
    }

    /* ---- per-update rendering ---- */
    function update(vm) {
      if (!built) build(vm);
      var s = vm.state, t = vm.tally;

      // topbar score + turn
      var dec = t.decisive;
      setText(refs.turnNum, String(s.turn));
      clear(refs.evSummary);
      refs.evSummary.appendChild(h('span', { class: 'score-you' }, 'YOU ' + dec.playerEV));
      refs.evSummary.appendChild(h('span', { class: 'score-sep' }, '—'));
      refs.evSummary.appendChild(h('span', { class: 'score-opp' }, dec.oppEV + ' OPP'));
      refs.evSummary.appendChild(h('span', { class: 'score-tag ' + (dec.playerEV >= 270 ? 'is-good' : 'is-bad') }, dec.playerEV >= 270 ? 'PROJECTED WIN' : 'BEHIND 270'));

      // KPI cards
      KPI_DEFS.forEach(function (def) {
        var ref = refs.kpiCards[def.key];
        setText(ref.value, def.fmt(s));
        var d = vm.deltas[def.key] || 0;
        // Arrows convey sentiment (green up = good news): for inverted stats like
        // scandal, a DROP is the good (up) direction, so all KPIs read consistently.
        var improving = def.invert ? d < 0 : d > 0;
        var dir = Math.abs(d) < 0.05 ? 'flat' : (improving ? 'up' : 'down');
        ref.delta.className = 'kpi-card__delta is-' + dir;
        var mag = def.money ? Util.formatMoney(Math.abs(d) * 1000) : (Math.round(Math.abs(d) * 10) / 10);
        ref.delta.textContent = dir === 'flat' ? 'no change' : mag + ' this week';
        if (vm.series[def.key] && vm.series[def.key].length >= 2) {
          Charts.sparkline(ref.spark, vm.series[def.key], { color: def.color, width: 120, height: 30 });
        }
      });

      // EV bar
      var total = 538;
      refs.ecPlayer.style.width = (t.playerEV / total * 100) + '%';
      refs.ecUndecided.style.width = (t.tossupEV / total * 100) + '%';
      refs.ecOpp.style.width = (t.oppEV / total * 100) + '%';
      setText(refs.ecPlayer, t.playerEV ? String(t.playerEV) : '');
      setText(refs.ecUndecided, t.tossupEV ? String(t.tossupEV) : '');
      setText(refs.ecOpp, t.oppEV ? String(t.oppEV) : '');
      refs.ecBar.setAttribute('aria-label', 'Projected electoral votes: you ' + dec.playerEV + ', opponent ' + dec.oppEV + ', ' + t.tossupEV + ' in tossups; 270 to win.');

      // map
      mapController.update(s.regions);
      mapController.setSelected(vm.selectedRegionId);
      mapController.highlightTargets(s.intel && s.intel.active ? s.intel.oppTargets : []);

      // polling chart
      renderPollingChart(vm);

      // region detail
      renderRegionDetail(vm);

      // action list
      renderActions(vm);

      // opponent + log
      renderOpponent(vm);
      renderLog(vm);

      // undo availability
      refs.undoBtn.disabled = !s.canUndo;
    }

    function renderPollingChart(vm) {
      var hist = vm.state.history || [];
      var youPts = hist.map(function (p) { return { x: p.turn, y: p.playerSupport }; });
      var oppPts = hist.map(function (p) { return { x: p.turn, y: p.oppSupport }; });
      Charts.lineChart(refs.chartMount, {
        width: 520, height: 200,
        series: [
          { name: 'You', points: youPts, color: 'var(--color-primary-bright)' },
          { name: 'Opponent', points: oppPts, color: 'var(--color-opponent-bright)' }
        ],
        xLabels: hist.map(function (p) { return 'W' + p.turn; }),
        yMin: 30, yMax: 70,
        ariaLabel: 'Polling trend by week: your support versus the opponent.'
      });
    }

    function renderRegionDetail(vm) {
      var body = refs.regionPanelBody;
      clear(body);
      var s = vm.state;
      var r = vm.selectedRegionId ? findRegion(s.regions, vm.selectedRegionId) : null;
      if (!r) {
        body.appendChild(h('p', { class: 'muted-note' }, 'Select a region on the map to target air-war and ground-game actions there.'));
        return;
      }
      var lean = r.lean;
      var leanCls = MapView.leanClass(lean);
      var isTarget = s.intel && s.intel.active && s.intel.oppTargets.indexOf(r.id) !== -1;
      body.appendChild(h('div', { class: 'region-detail__head' }, [
        h('span', { class: 'region-chip ' + leanCls }, r.abbreviation),
        h('div', null, [h('strong', { class: 'region-detail__name' }, r.name), h('div', { class: 'region-detail__ev' }, r.electoralVotes + ' electoral votes')])
      ]));
      body.appendChild(h('div', { class: 'region-detail__lean' }, [
        h('span', { class: 'badge ' + (lean > 3 ? 'is-good' : lean < -3 ? 'is-bad' : 'is-warn') }, MapView.leanLabel(lean)),
        isTarget ? h('span', { class: 'badge is-bad' }, [icon('target', 12), ' Opponent target']) : null
      ]));
      var meta = [['Archetype', r.archetype || '—'], ['Ad cost', '×' + r.mediaCostMultiplier], ['Volatility', Math.round(r.volatility * 100) + '%'], ['Ground op', r.organized ? (r.fieldOffice ? 'Field office' : 'Organized') : 'None']];
      if (s.intel && s.intel.active && s.intel.revealBaselines) meta.push(['Baseline', Util.formatSigned(r.baseLean)]);
      body.appendChild(h('dl', { class: 'region-meta' }, meta.map(function (kv) {
        return h('div', { class: 'region-meta__row' }, [h('dt', null, kv[0]), h('dd', null, String(kv[1]))]);
      })));
      body.appendChild(h('p', { class: 'muted-note small' }, 'Region-targeted actions below will act on ' + r.name + '.'));
    }

    function renderActions(vm) {
      var list = refs.actionList;
      clear(list);
      vm.actions.forEach(function (a) {
        var needsRegion = a.targeting === 'region' && !vm.selectedRegionId;
        var disabled = !a.affordable || needsRegion;
        var reason = a.reason || (needsRegion ? 'Select a region' : null);
        var card = h('button', {
          class: 'action-card' + (disabled ? ' is-disabled' : ''),
          type: 'button', disabled: disabled || null,
          'data-action': a.id,
          'aria-label': a.name + ', costs ' + a.costAP + ' action points and ' + Util.formatMoney(a.costFunds * 1000) + (reason ? ', ' + reason : '')
        }, [
          h('div', { class: 'action-card__head' }, [
            h('span', { class: 'action-card__name' }, a.name),
            h('span', { class: 'action-card__cost' }, [
              h('span', { class: 'cost-ap', title: 'Action Points' }, a.costAP + ' AP'),
              h('span', { class: 'cost-funds', title: 'Funds' }, a.costFunds > 0 ? Util.formatMoney(a.costFunds * 1000) : 'Free')
            ])
          ]),
          h('div', { class: 'action-card__desc' }, a.desc),
          a.targeting === 'region' ? h('span', { class: 'action-card__tag' }, 'Region') : h('span', { class: 'action-card__tag is-national' }, 'National'),
          reason && disabled ? h('span', { class: 'action-card__reason' }, reason) : null
        ]);
        if (!disabled) card.addEventListener('click', function () { cbk.onAction(a.id); });
        list.appendChild(card);
      });
    }

    function renderOpponent(vm) {
      var body = refs.oppBody;
      clear(body);
      var o = vm.state.opponent;
      body.appendChild(h('p', { class: 'opp-note' }, o.strategyNote || 'The opponent is planning its next move.'));
      body.appendChild(meterRow('Opponent momentum', o.momentum, -100, 100, o.momentum > 40 ? 'is-bad' : o.momentum > 0 ? 'is-warn' : 'is-good'));
      body.appendChild(meterRow('Opponent scandal', o.scandalLevel, 0, 100, o.scandalLevel > 60 ? 'is-good' : 'is-warn'));
      if (vm.state.intel && vm.state.intel.active && vm.state.intel.oppTargets.length) {
        var names = vm.state.intel.oppTargets.map(function (id) { var r = findRegion(vm.state.regions, id); return r ? r.abbreviation : id; });
        body.appendChild(h('p', { class: 'intel-line' }, [icon('target', 13), h('span', null, ' Intel: opponent eyeing ' + names.join(', '))]));
      }
    }

    function meterRow(label, value, min, max, cls) {
      var frac = (value - min) / (max - min);
      return h('div', { class: 'opp-meter' }, [
        h('div', { class: 'opp-meter__head' }, [h('span', null, label), h('span', { class: 'opp-meter__val' }, Math.round(value))]),
        h('span', { class: 'meter' }, [h('span', { class: 'meter__track' }, [h('span', { class: 'meter__fill ' + (cls || ''), style: 'width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' })])])
      ]);
    }

    function renderLog(vm) {
      var body = refs.logBody;
      clear(body);
      var entries = (vm.state.log || []).slice(-14).reverse();
      if (!entries.length) { body.appendChild(h('p', { class: 'muted-note small' }, 'Your campaign decisions will appear here.')); return; }
      entries.forEach(function (e) {
        body.appendChild(h('div', { class: 'log-entry is-' + (e.kind || 'neutral') }, [
          h('span', { class: 'log-entry__turn' }, 'W' + e.turn), h('span', { class: 'log-entry__text' }, e.text)
        ]));
      });
    }

    function destroy() { if (mapController) mapController.destroy(); clear(root); built = false; }

    return { update: update };
  }

  function findRegion(regions, id) {
    for (var i = 0; i < regions.length; i++) if (regions[i].id === id) return regions[i];
    return null;
  }

  /* ===================================================================== *
   * EVENT MODAL
   * ===================================================================== */
  function showEventModal(rootEl, opts) {
    var ev = opts.event;
    var card = h('div', { class: 'modal__card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'event-title' }, [
      h('span', { class: 'badge is-info modal__kicker' }, ev.category.replace(/-/g, ' ')),
      h('h2', { class: 'modal__title', id: 'event-title' }, ev.title),
      h('div', { class: 'modal__body' }, [h('p', null, ev.description)]),
      h('div', { class: 'modal__actions' }, ev.choices.map(function (c) {
        var previews = (c.effects || []).map(function (eff) {
          var fx = effectText(eff);
          return h('span', { class: 'fx ' + (fx.neutral ? 'is-flat' : fx.good ? 'is-good' : 'is-bad') }, fx.text);
        });
        var choice = h('button', { class: 'event-choice', type: 'button' }, [
          h('span', { class: 'event-choice__label' }, c.label),
          c.description ? h('span', { class: 'event-choice__sub' }, c.description) : null,
          h('span', { class: 'event-choice__preview' }, previews)
        ]);
        choice.addEventListener('click', function () { close(); opts.onChoose(c.id); });
        return choice;
      }))
    ]);
    var modal = h('div', { class: 'modal', role: 'presentation' }, [h('div', { class: 'modal__backdrop' }), card]);
    rootEl.appendChild(modal);

    // focus trap
    var focusables = card.querySelectorAll('button');
    if (focusables.length) focusables[0].focus();
    function onKey(e) {
      if (e.key === 'Tab' && focusables.length) {
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    modal.addEventListener('keydown', onKey);
    function close() { modal.removeEventListener('keydown', onKey); if (modal.parentNode) modal.parentNode.removeChild(modal); }
    announce('Event: ' + ev.title);
    return { close: close };
  }

  /* ===================================================================== *
   * END SCREEN (win / lose)
   * ===================================================================== */
  function renderEndScreen(rootEl, vm, cb) {
    clear(rootEl);
    var won = vm.state.status === 'won';
    var dec = vm.tally.decisive;
    var deps = vm.deps;

    var recapStats = [
      ['Your electoral votes', dec.playerEV],
      ['Opponent', dec.oppEV],
      ['Final momentum', Math.round(vm.state.national.momentum)],
      ['Final scandal', Math.round(vm.state.national.scandalLevel)],
      ['War chest', deps.Util.formatMoney(vm.state.resources.funds * 1000)],
      ['Weeks played', vm.state.turn]
    ];

    var chartMount = h('div', { class: 'chart' });
    var screen = h('div', { class: 'screen ' + (won ? 'screen--win' : 'screen--lose') }, [
      h('span', { class: won ? 'brand-star is-win' : 'brand-star is-lose', 'aria-hidden': 'true' }),
      h('h1', null, won ? 'Victory' : 'Defeat'),
      h('p', { class: 'screen__verdict' }, vm.state.endReason || (won ? 'You reached 270.' : 'You fell short of 270.')),
      h('div', { class: 'ec-bar', role: 'img', 'aria-label': 'Final electoral votes: you ' + dec.playerEV + ', opponent ' + dec.oppEV }, [
        h('div', { class: 'ec-bar__player', style: 'width:' + (dec.playerEV / 538 * 100) + '%' }, String(dec.playerEV)),
        h('div', { class: 'ec-bar__opp', style: 'width:' + (dec.oppEV / 538 * 100) + '%' }, String(dec.oppEV)),
        h('div', { class: 'ec-bar__needle', style: 'left:50.2%' })
      ]),
      h('dl', { class: 'recap-grid' }, recapStats.map(function (kv) {
        return h('div', { class: 'recap-cell' }, [h('dt', null, kv[0]), h('dd', null, String(kv[1]))]);
      })),
      h('div', { class: 'panel' }, [h('div', { class: 'panel__title' }, [icon('chart'), h('span', null, 'How the race moved')]), h('div', { class: 'panel__body' }, [chartMount])]),
      h('div', { class: 'start-actions' }, [
        h('button', { class: 'btn btn--accent btn--block', type: 'button', onclick: function () { cb.onReplay(); } }, [icon('refresh'), 'Play again'])
      ])
    ]);
    rootEl.appendChild(screen);

    var hist = vm.state.history || [];
    deps.Charts.lineChart(chartMount, {
      width: 640, height: 220,
      series: [
        { name: 'You', points: hist.map(function (p) { return { x: p.turn, y: p.playerEV }; }), color: 'var(--color-primary-bright)' },
        { name: 'Opponent', points: hist.map(function (p) { return { x: p.turn, y: p.oppEV }; }), color: 'var(--color-opponent-bright)' }
      ],
      xLabels: hist.map(function (p) { return 'W' + p.turn; }),
      ariaLabel: 'Electoral votes by week for you and the opponent.'
    });
    var btn = rootEl.querySelector('.btn--accent');
    if (btn) btn.focus();
    announce(won ? 'Victory. ' + vm.state.endReason : 'Defeat. ' + vm.state.endReason);
  }

  return {
    h: h, icon: icon, toast: toast, announce: announce, effectText: effectText,
    renderStart: renderStart,
    createDashboard: createDashboard,
    showEventModal: showEventModal,
    renderEndScreen: renderEndScreen
  };
});
