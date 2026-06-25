/*
 * Campaign Trail — game engine (Campaign.Engine)
 *
 * PURE game logic. No DOM access whatsoever — it can be driven entirely from a
 * headless Node harness (see test/sim.js) or from the browser UI (src/ui.js).
 *
 * UMD: under Node it is module.exports and pulls its sibling modules via
 * require(); in the browser it attaches to window.Campaign.Engine and reads the
 * already-loaded globals. Load order in index.html:
 *   rng -> util -> charts -> map -> data -> engine -> ui -> main
 *
 * Determinism: every random draw flows through a seeded RNG whose draw COUNT is
 * tracked, so (seed, candidate, difficulty, action-sequence) reproduces an
 * identical game and save/load restores the exact RNG stream position.
 *
 * The numbers implemented here come straight from src/data.js:
 *   - design.actions[].effectSummary  (action formulas)
 *   - design.turnStructure.phases     (upkeep / resolution order)
 *   - design.winConditions/.failConditions[].rule
 *   - design.opponentAI + difficultyModifiers
 *   - design.balance + candidates[].startingModifiers
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./rng.js'), require('./util.js'), require('./map.js'), require('./data.js')
    );
  } else {
    root.Campaign = root.Campaign || {};
    root.Campaign.Engine = factory(root.Campaign.RNG, root.Campaign.Util, root.Campaign.MapView, root.Campaign.Data);
  }
})(typeof self !== 'undefined' ? self : this, function (RNG, Util, MapView, Data) {
  'use strict';

  /* ===================================================================== *
   * Static spec pulled from data.js
   * ===================================================================== */
  var design = Data.design;
  var BAL = design.balance;
  var ACTIONS = design.actions;
  var ACTION_BY_ID = {};
  ACTIONS.forEach(function (a) { ACTION_BY_ID[a.id] = a; });

  var TOTAL_EV = BAL.totalElectoralVotes;           // 538
  var VOTES_TO_WIN = BAL.electoralVotesToWin;        // 270
  var MAX_TURNS = design.turnStructure.totalTurns;   // 12
  var AP_PER_TURN = design.turnStructure.actionPointsPerTurn; // 5
  var EVENT_CHANCE = BAL.eventChancePerTurn;          // 0.45
  var BASE_VOLATILITY = BAL.baseVolatility;           // 2.5
  var BANKRUPTCY = BAL.bankruptcyThreshold;           // 0
  var SCANDAL_LOSS = BAL.scandalLossThreshold;        // 80
  var SAFE_LEAN = 40;     // |lean| >= 40 => "safe"; opponent never spends here
  var TOSSUP_BAND = 3;    // matches MapView display band

  // Empirically-tuned engine-side balance bounds (NOT in data.js — they enforce
  // the data.js balance.notes goal of "three viable lanes tuned to comparable
  // strength" and stop the ground lane from snowballing to a turn-6 early clinch.
  // Without these the volunteer pool grows unbounded and a single canvass swings
  // +30..+57 lean, letting ground win 24/24 at every difficulty by ~week 6.)
  var MAX_VOLUNTEERS = 30;          // ground-army ceiling (in thousands)
  var CANVASS_VOL_COEFF = 0.4;      // canvass lean per volunteer (data.js prose: 0.6)
  var MAX_FIELD_OFFICE_PASSIVE = 5; // cap per-region passive lean/turn from field offices
  var MAX_GOTV_PASSIVE = 0.8;       // cap the standing recruit GOTV bonus

  var clamp = Util.clamp;

  /* ===================================================================== *
   * Candidate starting modifiers — the prose in data.js codified to numbers.
   * Defaults are applied first, then the per-candidate overrides.
   * ===================================================================== */
  var CANDIDATE_DEFAULTS = {
    startFunds: 1200, startVolunteers: 8, startMomentum: 0, startApproval: 0, startBuzz: 0,
    tvCostFunds: 180,        // TV / Social Ad Blitz funds cost
    tvAdMult: 1,             // multiplier on TV blitz lean
    groundMult: 1,           // Build Field Office + Volunteer Canvass effectiveness
    recruitMult: 1,          // Recruit Volunteers effectiveness
    rallyMomMult: 1,         // Rally/Debate momentum & buzz multiplier
    rallyBuzzMult: 1,
    viralBonus: 0,           // flat add to rally viral chance
    gaffeChance: 0.12,       // rally gaffe chance
    damageControlAmt: 20,    // scandal removed by Damage Control
    fundraiserMult: 1,       // Major Fundraiser yield multiplier
    attritionRate: 0.05      // volunteer attrition when no ground action
  };
  var CANDIDATE_MODS = {
    charismatic_outsider: {
      startMomentum: 20, startBuzz: 15, startVolunteers: 4,
      rallyMomMult: 1.2, rallyBuzzMult: 1.2, viralBonus: 0.05,
      groundMult: 0.85, gaffeChance: 0.18
    },
    seasoned_insider: {
      startFunds: 1450, startApproval: 10, startMomentum: -10,
      tvCostFunds: 150, damageControlAmt: 26,
      rallyMomMult: 0.8, rallyBuzzMult: 0.8
    },
    grassroots_organizer: {
      startVolunteers: 16, startFunds: 950,
      groundMult: 1.2, recruitMult: 1.2, attritionRate: 0.025,
      fundraiserMult: 0.85, tvAdMult: 0.9
    }
  };
  function candidateMods(candidateId) {
    var m = {};
    var k;
    for (k in CANDIDATE_DEFAULTS) m[k] = CANDIDATE_DEFAULTS[k];
    var over = CANDIDATE_MODS[candidateId] || {};
    for (k in over) m[k] = over[k];
    return m;
  }

  var DIFFICULTY = {
    easy:   { strength: 0.7, gains: 0.8, momAccrual: 4, counterpunch: false, oppoPriority: false, startEdgeRegions: 0 },
    normal: { strength: 1.0, gains: 1.0, momAccrual: 6, counterpunch: true,  oppoPriority: false, startEdgeRegions: 0 },
    hard:   { strength: 1.25, gains: 1.05, momAccrual: 7, counterpunch: true, oppoPriority: true,  startEdgeRegions: 2 }
  };

  /* ===================================================================== *
   * Seeded RNG facade with a serializable draw counter.
   * Only this object's methods are used for randomness, and every draw goes
   * through next(), so `draws` fully captures stream position for save/load.
   * ===================================================================== */
  function makeRng(seed, draws) {
    var base = RNG.create(seed);
    var n = 0;
    var i;
    for (i = 0; i < (draws || 0); i++) { base.next(); n++; } // fast-forward on load
    function next() { n++; return base.next(); }
    return {
      seed: String(seed),
      draws: function () { return n; },
      next: next,
      float: function (a, b) { return a + (b - a) * next(); },
      int: function (a, b) { return Math.floor(a + (b - a + 1) * next()); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      gaussian: function (mean, sd) {
        var u = 0, v = 0;
        while (u === 0) u = next();
        while (v === 0) v = next();
        var g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        return (mean || 0) + (sd == null ? 1 : sd) * g;
      },
      weightedPick: function (items, weightFn) {
        if (!items || !items.length) return undefined;
        var total = 0, weights = new Array(items.length), i, w;
        for (i = 0; i < items.length; i++) {
          w = Math.max(0, weightFn ? weightFn(items[i], i) : (items[i].weight != null ? items[i].weight : 1));
          weights[i] = w; total += w;
        }
        var r = next() * (total <= 0 ? items.length : total);
        if (total <= 0) return items[Math.floor(r)];
        for (i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
        return items[items.length - 1];
      }
    };
  }

  /* ===================================================================== *
   * Helpers
   * ===================================================================== */
  function momentumMult(momentum) { return 1 + momentum / 200; }           // caps +/-50%
  function scandalPenalty(scandal) { return 1 - Math.max(0, scandal - 30) * 0.005; }
  function baselineOf(initialLean) { return clamp(initialLean, -30, 30); } // structural baseline in [-30,30]

  function regionById(state, id) {
    for (var i = 0; i < state.regions.length; i++) if (state.regions[i].id === id) return state.regions[i];
    return null;
  }
  function clampRegion(r) { r.lean = clamp(r.lean, -100, 100); }
  function clampNational(state) {
    var n = state.national;
    n.momentum = clamp(n.momentum, -100, 100);
    n.nationalApproval = clamp(n.nationalApproval, -100, 100);
    n.scandalLevel = clamp(n.scandalLevel, 0, 100);
    n.mediaBuzz = clamp(n.mediaBuzz, 0, 100);
    var o = state.opponent;
    o.momentum = clamp(o.momentum, -100, 100);
    o.scandalLevel = clamp(o.scandalLevel, 0, 100);
    o.funds = Math.max(0, o.funds);
    state.resources.funds = Math.round(state.resources.funds);
    state.resources.volunteers = clamp(state.resources.volunteers, 0, MAX_VOLUNTEERS);
  }

  // Decisive (election-day) assignment: lean > 0 => player, lean <= 0 => opponent.
  function decisiveTally(state) {
    var p = 0, o = 0, safe = 0;
    state.regions.forEach(function (r) {
      if (r.lean > 0) p += r.electoralVotes; else o += r.electoralVotes;
      if (r.lean >= SAFE_LEAN) safe += r.electoralVotes;
    });
    return { playerEV: p, oppEV: o, safeEV: safe };
  }

  // Display tally (3-way with tossup band) — mirrors Campaign.MapView.tally.
  function displayTally(state) {
    if (MapView && typeof MapView.tally === 'function') {
      return MapView.tally(state.regions, VOTES_TO_WIN);
    }
    var p = 0, o = 0, t = 0;
    state.regions.forEach(function (r) {
      if (Math.abs(r.lean) <= TOSSUP_BAND) t += r.electoralVotes;
      else if (r.lean > 0) p += r.electoralVotes; else o += r.electoralVotes;
    });
    return { playerEV: p, oppEV: o, tossupEV: t, votesToWin: VOTES_TO_WIN };
  }

  function log(state, kind, text) {
    state.log.push({ turn: state.turn, kind: kind, text: text });
    if (state.log.length > 200) state.log.shift();
  }

  function avgLeanWeighted(state) {
    var num = 0, den = 0;
    state.regions.forEach(function (r) { num += r.lean * r.electoralVotes; den += r.electoralVotes; });
    return den ? num / den : 0;
  }

  function pushHistory(state) {
    var d = decisiveTally(state);
    var avg = avgLeanWeighted(state);
    var playerSupport = clamp(50 + avg * 0.4, 5, 95);
    state.history.push({
      turn: state.turn,
      playerSupport: Util.round(playerSupport, 1),
      oppSupport: Util.round(100 - playerSupport, 1),
      momentum: Util.round(state.national.momentum, 1),
      playerEV: d.playerEV,
      oppEV: d.oppEV
    });
  }

  /* ===================================================================== *
   * Action cost (funds can vary by region for paid-media buys)
   * ===================================================================== */
  var MEDIA_ACTIONS = { tv_ad_blitz: true, attack_ad: true };
  function fundsCostFor(state, action, region) {
    var base = action.costFunds;
    if (action.id === 'tv_ad_blitz') base = state.mods.tvCostFunds;
    if (MEDIA_ACTIONS[action.id] && region) base = base * region.mediaCostMultiplier;
    return Math.round(base);
  }

  /* ===================================================================== *
   * Event channel application (also used by player events)
   * selector: all | strongest | weakest | random | mostVotes | none
   * ===================================================================== */
  function applyRegionLeanEffect(state, rng, value, selector) {
    var regions = state.regions;
    var targets = [];
    var sorted;
    switch (selector) {
      case 'all':
        targets = regions.slice(); break;
      case 'strongest':
        sorted = regions.slice().sort(function (a, b) { return b.lean - a.lean; });
        if (sorted[0]) targets = [sorted[0]]; break;
      case 'weakest':
        sorted = regions.slice().sort(function (a, b) { return a.lean - b.lean; });
        if (sorted[0]) targets = [sorted[0]]; break;
      case 'mostVotes':
        sorted = regions.slice().sort(function (a, b) { return b.electoralVotes - a.electoralVotes; });
        if (sorted[0]) targets = [sorted[0]]; break;
      case 'random':
        targets = [rng.pick(regions)]; break;
      case 'none':
      default:
        targets = []; break;
    }
    targets.forEach(function (r) { r.lean += value; clampRegion(r); });
    return targets.map(function (r) { return r.abbreviation; });
  }

  function applyChannelEffect(state, rng, eff) {
    var v = eff.value;
    var n = state.national, o = state.opponent, res = state.resources;
    switch (eff.type) {
      case 'funds': res.funds += v; break;
      case 'volunteers': res.volunteers = Math.max(0, res.volunteers + v); break;
      case 'actionPoints': res.actionPoints = Math.max(0, res.actionPoints + v); break;
      case 'momentum': n.momentum += v; break;
      case 'nationalApproval': n.nationalApproval += v; break;
      case 'scandalLevel': n.scandalLevel += v; break;
      case 'mediaBuzz': n.mediaBuzz += v; break;
      case 'opponentMomentum': o.momentum += v; break;
      case 'opponentScandal': o.scandalLevel += v; break;
      case 'regionLean': return applyRegionLeanEffect(state, rng, v, eff.selector);
      default: break;
    }
    clampNational(state);
    return null;
  }

  /* ===================================================================== *
   * Engine instance
   * ===================================================================== */
  function createInstance(state, rng, fresh) {
    // bookkeeping that is NOT serialized lives on the closure; serialized
    // bookkeeping lives on `state`.
    var undoStack = [];   // deep snapshots within the current turn (for undoLastAction)

    function snapshot() { return JSON.stringify(state); }
    function restore(snap) {
      var s = JSON.parse(snap);
      var k;
      for (k in state) { if (!(k in s)) delete state[k]; }
      for (k in s) state[k] = s[k];
      rng = makeRng(state.seed, state.draws);
    }
    function syncDraws() { state.draws = rng.draws(); }

    /* ---- action availability ---- */
    function describeAction(action, region) {
      var costFunds = fundsCostFor(state, action, region);
      var reason = null;
      var affordable = true;
      if (state.resources.actionPoints < action.costActionPoints) { affordable = false; reason = 'Not enough Action Points'; }
      else if (state.resources.funds < costFunds) { affordable = false; reason = 'Not enough Funds'; }
      else if (action.targeting === 'region' && !region) { affordable = false; reason = 'Select a region'; }
      return {
        id: action.id, name: action.name, desc: action.description,
        costFunds: costFunds, costAP: action.costActionPoints,
        targeting: action.targeting,
        affordable: affordable, reason: reason
      };
    }

    function availableActions(targetRegionId) {
      var region = targetRegionId ? regionById(state, targetRegionId) : null;
      return ACTIONS.map(function (a) { return describeAction(a, region); });
    }

    function canAfford(actionId, targetRegionId) {
      var a = ACTION_BY_ID[actionId];
      if (!a) return false;
      var region = targetRegionId ? regionById(state, targetRegionId) : null;
      if (state.resources.actionPoints < a.costActionPoints) return false;
      if (state.resources.funds < fundsCostFor(state, a, region)) return false;
      return true;
    }

    /* ---- action effects ---- */
    function regionBonus() {
      // polling-consultant +25% to the NEXT region-targeted action this turn
      var b = 1 + (state.nextRegionActionBonus || 0);
      return b;
    }
    function consumeRegionBonus() { state.nextRegionActionBonus = 0; }

    function doAction(actionId, targetRegionId) {
      if (state.status !== 'playing') return { ok: false, error: 'Game is over' };
      if (state.pendingEvent) return { ok: false, error: 'Resolve the pending event first' };
      var a = ACTION_BY_ID[actionId];
      if (!a) return { ok: false, error: 'Unknown action' };
      var region = null;
      if (a.targeting === 'region') {
        if (!targetRegionId) return { ok: false, error: 'This action needs a target region' };
        region = regionById(state, targetRegionId);
        if (!region) return { ok: false, error: 'Unknown region' };
      }
      var costFunds = fundsCostFor(state, a, region);
      if (state.resources.actionPoints < a.costActionPoints) return { ok: false, error: 'Not enough Action Points' };
      if (state.resources.funds < costFunds) return { ok: false, error: 'Not enough Funds' };

      // snapshot for undo (captures rng draw position too)
      syncDraws();
      undoStack.push(snapshot());

      // spend
      state.resources.actionPoints -= a.costActionPoints;
      state.resources.funds -= costFunds;

      var mods = state.mods;
      var n = state.national, o = state.opponent;
      var mm = momentumMult(n.momentum);
      var sp = scandalPenalty(n.scandalLevel);
      var result = { actionId: actionId, region: region ? region.abbreviation : null, deltas: {} };
      var groundAction = false;
      var delta;

      switch (actionId) {
        case 'tv_ad_blitz': {
          var core = Math.max(3, a.magnitude * mm * sp);     // floor +3
          delta = core * mods.tvAdMult * (region.blitzCount >= 3 ? 0.6 : 1) * regionBonus();
          region.lean += delta; clampRegion(region);
          region.blitzCount = (region.blitzCount || 0) + 1;
          region.touchedByPlayer = true;
          n.mediaBuzz += 3;
          result.deltas.lean = Util.round(delta, 1);
          consumeRegionBonus();
          log(state, 'neutral', 'Aired a TV/social blitz in ' + region.name + ' (+' + Util.round(delta, 1) + ' lean).');
          break;
        }
        case 'attack_ad': {
          delta = a.magnitude * mm * regionBonus();
          region.lean += delta; clampRegion(region);
          o.momentum -= 6; o.scandalLevel += 5; n.scandalLevel += 3;
          result.deltas.lean = Util.round(delta, 1);
          consumeRegionBonus();
          log(state, 'neutral', 'Ran an attack ad in ' + region.name + ' (+' + Util.round(delta, 1) + ' lean; +3 your scandal).');
          break;
        }
        case 'build_field_office': {
          groundAction = true;
          delta = a.magnitude * mods.groundMult * regionBonus();
          region.lean += delta; clampRegion(region);
          region.organized = true;
          region.fieldOffice = (region.fieldOffice || 0) + 1;
          state.resources.volunteers += 3;
          result.deltas.lean = Util.round(delta, 1);
          consumeRegionBonus();
          log(state, 'good', 'Opened a field office in ' + region.name + ' (sticky +' + Util.round(delta, 1) + ', passive lean each week).');
          break;
        }
        case 'volunteer_canvass': {
          groundAction = true;
          delta = (5 + state.resources.volunteers * CANVASS_VOL_COEFF) * mm * mods.groundMult * regionBonus();
          region.lean += delta; clampRegion(region);
          region.organized = true;
          n.nationalApproval += 1;
          result.deltas.lean = Util.round(delta, 1);
          consumeRegionBonus();
          log(state, 'good', 'Canvassed ' + region.name + ' with volunteers (+' + Util.round(delta, 1) + ' sticky lean).');
          break;
        }
        case 'recruit_volunteers': {
          groundAction = true;
          var gain = (8 + (n.mediaBuzz > 40 ? 2 : 0)) * mods.recruitMult;
          state.resources.volunteers += gain;
          n.mediaBuzz += 2;
          state.gotvPassive = (state.gotvPassive || 0) + 0.4;
          result.deltas.volunteers = Util.round(gain, 1);
          log(state, 'good', 'Recruited ' + Util.round(gain, 1) + 'k volunteers (GOTV engine strengthens).');
          break;
        }
        case 'campaign_rally': {
          var leanGain = 6 * mm * regionBonus();
          var momGain = (10 + n.mediaBuzz * 0.05) * mods.rallyMomMult;
          var buzzGain = 8 * mods.rallyBuzzMult;
          var viralChance = 0.10 + n.mediaBuzz * 0.003 + mods.viralBonus;
          var viral = rng.chance(viralChance);
          if (viral) { leanGain *= 2; momGain *= 2; }
          region.lean += leanGain; clampRegion(region);
          region.touchedByPlayer = true;
          n.momentum += momGain; n.mediaBuzz += buzzGain;
          var gaffe = rng.chance(mods.gaffeChance);
          if (gaffe) n.scandalLevel += 3;
          result.deltas.lean = Util.round(leanGain, 1); result.viral = viral; result.gaffe = gaffe;
          consumeRegionBonus();
          log(state, viral ? 'good' : 'neutral',
            'Held a rally in ' + region.name + (viral ? ' — it went VIRAL!' : '') + ' (+' + Util.round(leanGain, 1) + ' lean, +' + Util.round(momGain, 0) + ' momentum)' + (gaffe ? ' but a gaffe nicked your scandal.' : '.'));
          break;
        }
        case 'major_fundraiser': {
          var yield_ = Math.round((220 + n.momentum * 2 + n.nationalApproval * 3) * (1 + n.mediaBuzz * 0.01) * mods.fundraiserMult);
          yield_ = Math.max(150, yield_);
          state.resources.funds += yield_;
          n.momentum -= 3;
          result.deltas.funds = yield_;
          log(state, 'good', 'Held a major fundraiser (+' + yield_ + 'k to the war chest).');
          break;
        }
        case 'opposition_research': {
          var successChance = 0.75 - Math.max(0, n.scandalLevel - 30) * 0.005;
          var success = rng.chance(successChance);
          if (success) {
            o.scandalLevel += 18; o.momentum -= 8; n.mediaBuzz += 6;
            result.success = true;
            log(state, 'good', 'Opposition research landed (+18 opponent scandal, opponent momentum sinks).');
          } else {
            n.scandalLevel += 12; o.scandalLevel += 9; n.mediaBuzz += 6;
            result.success = false;
            log(state, 'bad', 'Opposition research BACKFIRED (+12 your scandal).');
          }
          break;
        }
        case 'damage_control': {
          var was = n.scandalLevel;
          n.scandalLevel = Math.max(0, n.scandalLevel - mods.damageControlAmt);
          n.mediaBuzz -= 4;
          if (was > 50) n.momentum += 4;
          result.deltas.scandal = -(was - n.scandalLevel);
          log(state, 'good', 'Ran damage control (-' + (was - n.scandalLevel) + ' scandal).');
          break;
        }
        case 'debate_prep_appearance': {
          if (n.scandalLevel < 40) {
            n.nationalApproval += 5;
            n.momentum += 6 * mods.rallyMomMult;
            n.mediaBuzz += 16 * mods.rallyBuzzMult;
            result.outcome = 'clean';
            log(state, 'good', 'Won the debate / big interview (+approval, +momentum, +buzz).');
          } else if (rng.chance(0.45)) {
            n.scandalLevel += 10; n.momentum -= 5;
            result.outcome = 'backfire';
            log(state, 'bad', 'The debate went sideways under scandal pressure (+10 scandal).');
          } else {
            n.nationalApproval += 2.5;
            n.momentum += 3 * mods.rallyMomMult;
            n.mediaBuzz += 8 * mods.rallyBuzzMult;
            result.outcome = 'muted';
            log(state, 'neutral', 'A cautious debate under a scandal cloud — muted gains.');
          }
          break;
        }
        case 'counter_messaging': {
          var cut = 12 * (o.momentum > 40 ? 1.5 : 1);
          o.momentum -= cut; n.momentum += 3; n.mediaBuzz += 2;
          result.deltas.opponentMomentum = -cut;
          log(state, 'good', 'Counter-messaging blunted the opponent surge (-' + Util.round(cut, 0) + ' opponent momentum).');
          break;
        }
        case 'polling_consultant': {
          state.intel = { active: true, oppTargets: scoreOpponentTargets(state).slice(0, 2).map(function (x) { return x.id; }), revealBaselines: true };
          state.nextRegionActionBonus = 0.25;
          log(state, 'neutral', 'Hired a polling consultant — opponent targets revealed; next region play +25%.');
          break;
        }
        default:
          // refund on unknown
          state.resources.actionPoints += a.costActionPoints;
          state.resources.funds += costFunds;
          undoStack.pop();
          return { ok: false, error: 'Action not implemented: ' + actionId };
      }

      if (groundAction) state.groundActionThisTurn = true;
      clampNational(state);
      syncDraws();
      return { ok: true, result: result };
    }

    function undoLastAction() {
      if (!undoStack.length) return { ok: false, error: 'Nothing to undo this turn' };
      restore(undoStack.pop());
      return { ok: true };
    }

    /* ---- events ---- */
    function rollEvent() {
      if (!rng.chance(EVENT_CHANCE)) return;
      var pool = Data.events.filter(function (e) { return state.firedEvents.indexOf(e.id) === -1; });
      if (!pool.length) return;
      var ev = rng.weightedPick(pool, function (e) { return e.triggerWeight; });
      if (!ev) return;
      state.firedEvents.push(ev.id);
      state.pendingEvent = {
        id: ev.id, title: ev.title, category: ev.category, description: ev.description,
        choices: ev.choices.map(function (c) {
          return { id: c.id, label: c.label, description: c.description, effects: c.effects };
        })
      };
    }

    function hasPendingEvent() { return !!state.pendingEvent; }
    function getPendingEvent() { return state.pendingEvent ? JSON.parse(JSON.stringify(state.pendingEvent)) : null; }

    function resolveEvent(choiceId) {
      if (!state.pendingEvent) return { ok: false, error: 'No pending event' };
      var choice = null;
      state.pendingEvent.choices.forEach(function (c) { if (c.id === choiceId) choice = c; });
      if (!choice) return { ok: false, error: 'Unknown choice' };
      var applied = [];
      (choice.effects || []).forEach(function (eff) {
        var regions = applyChannelEffect(state, rng, eff);
        applied.push({ type: eff.type, value: eff.value, selector: eff.selector || null, regions: regions });
      });
      log(state, 'neutral', 'Event "' + state.pendingEvent.title + '": ' + choice.label + '.');
      state.pendingEvent = null;
      clampNational(state);
      syncDraws();
      return { ok: true, applied: applied };
    }

    /* ---- opponent AI ---- */
    function scoreOpponentTargets(s) {
      // Rank non-safe regions by attack value: tossups & thin player leads worth most EV.
      var scored = [];
      s.regions.forEach(function (r) {
        if (Math.abs(r.lean) >= SAFE_LEAN) return;       // never waste on safe regions
        if (r.lean <= -SAFE_LEAN + 10) return;            // already comfortably opponent
        var w = r.electoralVotes;
        var absLean = Math.abs(r.lean);
        if (absLean < 15) w *= 1.6;                       // tossup focus (~60% budget)
        if (r.lean > 0 && r.lean <= 20) w *= 1.4;         // knife-fight thin player leads
        if (r.touchedByPlayer) w *= 1.3;                  // counterpunch recent player pushes
        if (r.lean >= -25 && r.lean <= -10) w *= 0.8;     // its own flippable leads: lower prio
        scored.push({ id: r.id, region: r, score: w });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored;
    }

    function opponentTurn() {
      var s = state, o = s.opponent, diff = DIFFICULTY[s.difficulty] || DIFFICULTY.normal;
      var note = '';

      // refill internal funds for the budget
      var budget = (200 + (s.turn - 1) * 12) * diff.strength;

      // Self-preservation: broke -> fundraise the whole week
      if (o.funds < 150) {
        o.funds += Math.round(260 * diff.strength);
        o.momentum += diff.momAccrual * 0.5;
        clampNational(s);
        s.opponent.strategyNote = 'Opponent spent the week fundraising.';
        s.regions.forEach(function (r) { r.touchedByPlayer = false; });
        return;
      }
      // Self-preservation: high own scandal -> damage control
      if (o.scandalLevel > 55) {
        o.scandalLevel = Math.max(0, o.scandalLevel - 20);
        note = 'Opponent ran damage control. ';
      }

      var spend = Math.min(budget, o.funds);
      var effectiveness = (1 + o.momentum / 200) * (1 - o.scandalLevel * 0.005);
      effectiveness = Math.max(0.4, effectiveness) * diff.gains;

      var targets = scoreOpponentTargets(s);
      var hitNames = [];
      if (targets.length) {
        // concentrate fire on at most 2 regions: 60% / 40% of spend
        var alloc = targets.length >= 2 ? [0.6, 0.4] : [1.0];
        for (var ti = 0; ti < alloc.length && ti < targets.length; ti++) {
          var r = targets[ti].region;
          var regionSpend = spend * alloc[ti];
          var attacks = regionSpend / 110;                // ~110 funds per attack increment
          var move = attacks * 6.5 * effectiveness;        // ~6-7 lean per increment, scaled
          r.lean -= move; clampRegion(r);
          o.funds -= Math.round(regionSpend);
          hitNames.push(r.abbreviation);
        }
      }

      // Exploit player scandal: push it toward the 80 loss line
      if (s.national.scandalLevel > 40) {
        s.national.scandalLevel += rng.int(4, 8);
        note += 'Opponent fanned your scandal. ';
      }

      // Counterpunch national momentum/buzz with oppo research against the player
      if (diff.counterpunch && (s.national.momentum > 40 || s.national.mediaBuzz > 60 || diff.oppoPriority)) {
        s.national.scandalLevel += rng.int(3, 7);
        s.national.momentum -= 4;
      }

      // Activity accrues opponent momentum (the tailwind the player must suppress)
      o.momentum += diff.momAccrual;

      clampNational(s);
      s.regions.forEach(function (r) { r.touchedByPlayer = false; });
      o.strategyNote = note + (hitNames.length ? ('Opponent hit ' + hitNames.join(' & ') + '.') : 'Opponent regrouped.');
    }

    /* ---- upkeep (start-of-week model update) ---- */
    function upkeep() {
      var s = state, n = s.national, o = s.opponent;
      var mDrift = n.momentum * 0.05;
      var oDrift = o.momentum * 0.05;
      var gotv = Math.min(s.gotvPassive || 0, MAX_GOTV_PASSIVE);
      var vol = s.resources.volunteers;

      s.regions.forEach(function (r) {
        // momentum drift on all leans; opponent drift on contested leans
        r.lean += mDrift;
        if (Math.abs(r.lean) < SAFE_LEAN) r.lean -= oDrift;
        // field-office passive (sticky, organized) — bounded so it can't snowball
        if (r.fieldOffice) r.lean += Math.min(r.fieldOffice * 3 * (vol / 10), MAX_FIELD_OFFICE_PASSIVE);
        // recruit GOTV passive on player-leaning regions (bounded standing bonus)
        if (gotv && r.lean > 0) r.lean += gotv;
        // regression toward (baseline + approval*0.10); organized leans are sticky
        // but still erode (~70% rate), so ground must keep reinvesting, not coast.
        var target = r.baseLean + n.nationalApproval * 0.10;
        var rate = r.organized ? 0.085 : 0.12;
        r.lean += (target - r.lean) * rate;
        clampRegion(r);
      });

      // scandal drag
      if (n.scandalLevel > 40) {
        var drag = (n.scandalLevel - 40) / 10;
        n.momentum -= drag; n.nationalApproval -= drag;
      }
      // decays
      n.momentum *= (1 - 0.2);
      n.mediaBuzz *= (1 - 0.2);
      n.scandalLevel = Math.max(0, n.scandalLevel - 4);
      o.momentum *= (1 - 0.2);
      o.scandalLevel = Math.max(0, o.scandalLevel - 5);
      // volunteer attrition if no ground action last week
      if (!s.groundActionThisTurn) s.resources.volunteers *= (1 - s.mods.attritionRate);

      // volatility jolt on up to 2 contested regions (|lean| < 25)
      var contested = s.regions.filter(function (r) { return Math.abs(r.lean) < 25; });
      contested = shuffleInPlace(contested, _engineRng());
      for (var i = 0; i < Math.min(2, contested.length); i++) {
        var rr = contested[i];
        rr.lean += _engineRng().gaussian(0, BASE_VOLATILITY) * rr.volatility;
        clampRegion(rr);
      }
      clampNational(s);
    }

    function _engineRng() { return rng; }
    function shuffleInPlace(arr, r) {
      for (var i = arr.length - 1; i > 0; i--) { var j = r.int(0, i); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    }

    /* ---- win / fail evaluation ---- */
    function checkEndConditions() {
      var s = state;
      // scandal collapse — any resolution
      if (s.national.scandalLevel >= SCANDAL_LOSS) {
        return { status: 'lost', reason: 'Your campaign imploded under scandal (scandal ' + Math.round(s.national.scandalLevel) + ').', condition: 'fail_scandal_collapse' };
      }
      // opponent collapse — any resolution
      if (s.opponent.scandalLevel >= 90 && s.opponent.momentum <= -40) {
        return { status: 'won', reason: 'The opponent withdrew amid overwhelming scandal.', condition: 'win_opponent_collapse' };
      }
      var dt = decisiveTally(s);
      // bankruptcy — before turn 12, grace-protected
      if (s.turn < MAX_TURNS && s.resources.funds <= BANKRUPTCY && s.resources.volunteers < 3 && s.national.momentum < 0) {
        return { status: 'lost', reason: 'The campaign went insolvent and folded.', condition: 'fail_bankruptcy' };
      }
      // early clinch — turns <= 11
      if (s.turn < MAX_TURNS && dt.safeEV >= VOTES_TO_WIN && (TOTAL_EV - dt.safeEV) < VOTES_TO_WIN) {
        return { status: 'won', reason: 'You clinched an insurmountable ' + dt.safeEV + ' safe electoral votes — the opponent concedes.', condition: 'win_early_clinch' };
      }
      // election day
      if (s.turn >= MAX_TURNS) {
        if (dt.playerEV >= VOTES_TO_WIN) {
          return { status: 'won', reason: 'Election day: you carried ' + dt.playerEV + ' electoral votes and won the presidency!', condition: 'win_electoral_majority' };
        }
        return { status: 'lost', reason: 'Election day: you finished with ' + dt.playerEV + ' electoral votes, short of 270.', condition: 'fail_electoral_loss' };
      }
      return null;
    }

    /* ---- end turn (Opponent -> Resolution -> advance -> Briefing/Upkeep/Event) ---- */
    function endTurn() {
      if (state.status !== 'playing') return { ok: false, error: 'Game is over' };
      if (state.pendingEvent) return { ok: false, error: 'Resolve the pending event first' };

      var summary = { turn: state.turn, opponent: null, event: null, end: null };

      // Opponent AI phase (acts after the player)
      opponentTurn();
      summary.opponent = state.opponent.strategyNote;

      // Resolution: clamp, tally, history, end-conditions
      clampNational(state);
      pushHistory(state);
      var end = checkEndConditions();
      if (end) {
        state.status = end.status;
        state.endReason = end.reason;
        state.endCondition = end.condition;
        summary.end = end;
        undoStack = [];
        syncDraws();
        return { ok: true, summary: summary };
      }

      // advance to next week
      state.turn += 1;
      state.resources.actionPoints = AP_PER_TURN; // Briefing: refresh AP (does NOT bank)
      state.groundActionThisTurn = false;
      state.nextRegionActionBonus = 0; // polling-consultant bonus is "this turn" only
      state.intel = null;              // consultant intel is revealed "for one turn" only
      undoStack = [];

      upkeep();                 // start-of-week model update
      rollEvent();              // maybe fire a dynamic event
      summary.event = state.pendingEvent ? state.pendingEvent.title : null;

      syncDraws();
      return { ok: true, summary: summary };
    }

    /* ---- tally exposed to UI ---- */
    function tally() {
      var disp = displayTally(state);
      var dec = decisiveTally(state);
      disp.decisive = { playerEV: dec.playerEV, oppEV: dec.oppEV };
      disp.safeEV = dec.safeEV;
      return disp;
    }

    /* ---- state snapshot for UI ---- */
    function getState() {
      var snap = JSON.parse(JSON.stringify(state));
      snap.tally = tally();
      snap.canUndo = undoStack.length > 0;
      return snap;
    }

    /* ---- save / load ---- */
    function save() { syncDraws(); return JSON.stringify({ v: 1, state: state }); }

    // Fresh-game initialization (skipped on load): baseline poll, opening log,
    // and the optional week-1 event.
    if (fresh) {
      pushHistory(state);
      log(state, 'neutral', 'Week 1: the campaign begins — ' + decisiveTally(state).playerEV + ' projected electoral votes.');
      rollEvent();
    }

    return {
      getState: getState,
      availableActions: availableActions,
      canAfford: canAfford,
      doAction: doAction,
      undoLastAction: undoLastAction,
      hasPendingEvent: hasPendingEvent,
      getPendingEvent: getPendingEvent,
      resolveEvent: resolveEvent,
      endTurn: endTurn,
      tally: tally,
      checkEndConditions: checkEndConditions,
      save: save,
      // expose for intel / UI
      _opponentTargets: function () { return scoreOpponentTargets(state).map(function (x) { return x.id; }); }
    };
  }

  /* ===================================================================== *
   * Factory: create()
   * ===================================================================== */
  function create(opts) {
    opts = opts || {};
    var candidateId = opts.candidateId || (Data.candidates[0] && Data.candidates[0].id);
    var difficulty = (opts.difficulty && DIFFICULTY[opts.difficulty]) ? opts.difficulty : 'normal';
    var seed = opts.seed != null ? String(opts.seed) : ('seed-' + candidateId + '-' + difficulty);
    var mods = candidateMods(candidateId);
    var diff = DIFFICULTY[difficulty];

    var rng = makeRng(seed, 0);

    var regions = Data.regions.map(function (r) {
      return {
        id: r.id, name: r.name, abbreviation: r.abbreviation,
        electoralVotes: r.electoralVotes,
        lean: r.initialLean,
        baseLean: baselineOf(r.initialLean),
        volatility: r.volatility,
        mediaCostMultiplier: r.mediaCostMultiplier,
        population: r.population,
        archetype: r.archetype,
        organized: false,
        fieldOffice: 0,
        blitzCount: 0,
        touchedByPlayer: false
      };
    });

    // hard difficulty: opponent starts with +5 lean (toward it) in 4 high-value regions
    if (diff.startEdgeRegions > 0) {
      var byEv = regions.slice().sort(function (a, b) { return b.electoralVotes - a.electoralVotes; });
      for (var i = 0; i < diff.startEdgeRegions && i < byEv.length; i++) { byEv[i].lean -= 5; byEv[i].baseLean = baselineOf(byEv[i].lean); }
    }

    var state = {
      seed: seed,
      draws: 0,
      turn: 1,
      maxTurns: MAX_TURNS,
      status: 'playing',
      difficulty: difficulty,
      candidateId: candidateId,
      mods: mods,
      resources: {
        funds: mods.startFunds,
        actionPoints: AP_PER_TURN,
        volunteers: mods.startVolunteers
      },
      national: {
        momentum: mods.startMomentum,
        nationalApproval: mods.startApproval,
        scandalLevel: 0,
        mediaBuzz: mods.startBuzz
      },
      opponent: {
        momentum: 0,
        scandalLevel: 0,
        funds: 800,
        strategyNote: 'The opponent is sizing up the map.'
      },
      regions: regions,
      pendingEvent: null,
      history: [],
      log: [],
      firedEvents: [],
      gotvPassive: 0,
      nextRegionActionBonus: 0,
      intel: null,
      groundActionThisTurn: false,
      endReason: null,
      endCondition: null
    };

    return createInstance(state, rng, true);
  }

  function load(savedString) {
    var parsed = typeof savedString === 'string' ? JSON.parse(savedString) : savedString;
    var state = parsed && (parsed.state || parsed);
    // Validate the shape before constructing so a corrupt/tampered save fails
    // cleanly (the caller's try/catch turns this into a "no save" fallback)
    // rather than throwing later inside rendering/tally.
    if (!state || typeof state !== 'object' ||
        !Array.isArray(state.regions) || !state.regions.length ||
        !state.resources || typeof state.resources !== 'object' ||
        !state.national || typeof state.national !== 'object' ||
        typeof state.turn !== 'number' || !isFinite(state.turn) ||
        ['playing', 'won', 'lost'].indexOf(state.status) === -1) {
      throw new Error('Campaign.Engine.load: malformed or unrecognized save data');
    }
    // Validate/repair engine-critical region fields. lean & electoralVotes are
    // unrecoverable if absent/non-finite (reject); baseLean is the regression
    // target read every upkeep — if a tampered/old save omits it, upkeep would
    // turn the whole map to NaN, so repair it from the current lean.
    for (var ri = 0; ri < state.regions.length; ri++) {
      var reg = state.regions[ri];
      if (!reg || typeof reg !== 'object' ||
          typeof reg.lean !== 'number' || !isFinite(reg.lean) ||
          typeof reg.electoralVotes !== 'number' || !isFinite(reg.electoralVotes)) {
        throw new Error('Campaign.Engine.load: malformed or unrecognized save data');
      }
      if (typeof reg.baseLean !== 'number' || !isFinite(reg.baseLean)) reg.baseLean = baselineOf(reg.lean);
    }
    var rng = makeRng(state.seed, state.draws || 0);
    // ensure forward-compat defaults
    if (state.gotvPassive == null) state.gotvPassive = 0;
    if (state.nextRegionActionBonus == null) state.nextRegionActionBonus = 0;
    if (state.firedEvents == null) state.firedEvents = [];
    return createInstance(state, rng, false);
  }

  return {
    create: create,
    load: load,
    // expose constants for the UI / tests
    constants: {
      TOTAL_EV: TOTAL_EV, VOTES_TO_WIN: VOTES_TO_WIN, MAX_TURNS: MAX_TURNS,
      AP_PER_TURN: AP_PER_TURN, SAFE_LEAN: SAFE_LEAN, TOSSUP_BAND: TOSSUP_BAND
    }
  };
});
