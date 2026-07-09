/*!
 * Campaign Trail — MapView
 * Dependency-free, hand-rolled inline SVG cartogram tile-grid electoral map.
 *
 * There is NO real geography. Regions are packed into a clean square cartogram
 * (NPR-style), where each tile's AREA scales with its electoral votes. Tiles are
 * colored by `lean` on a 5-stop diverging scale (opponent red -> tossup amber ->
 * player blue) and are fully keyboard/mouse interactive.
 *
 * Public API (Campaign.MapView):
 *   create(container, opts) -> controller {
 *     update(regions), setSelected(regionId), highlightTargets(regionIds),
 *     destroy(), el (root svg)
 *   }
 *   tally(regions, votesToWin) -> { playerEV, oppEV, tossupEV, votesToWin }
 *   leanClass(lean) -> css class name        (helper, exported)
 *   leanColor(lean) -> hex color             (helper, exported)
 *   leanLabel(lean) -> "Player +6" style str (helper, exported)
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.Campaign = root.Campaign || {}; root.Campaign.MapView = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // |lean| <= TOSSUP_BAND counts as tossup/undecided for tally + labeling.
  const TOSSUP_BAND = 3;

  /* ----------------------------------------------------------------------- *
   * DOM helpers (guarded so require() in Node never crashes at load).
   * ----------------------------------------------------------------------- */
  function ensureDom() {
    if (typeof document === 'undefined') {
      throw new Error('Campaign.MapView requires a DOM (document is undefined).');
    }
  }

  function el(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const k in attrs) {
        if (attrs[k] == null) continue;
        node.setAttribute(k, String(attrs[k]));
      }
    }
    if (text != null) node.textContent = String(text);
    return node;
  }

  function resolveContainer(container) {
    ensureDom();
    let node = container;
    if (typeof container === 'string') node = document.querySelector(container);
    if (!node || typeof node.appendChild !== 'function') {
      throw new Error('Campaign.MapView: invalid container.');
    }
    return node;
  }

  function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }
  function num(v, fallback) { return isFiniteNum(v) ? v : fallback; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function prefersReducedMotion(opts) {
    if (opts && opts.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { /* ignore */ }
    }
    return false;
  }

  /* ----------------------------------------------------------------------- *
   * Lean -> color / class / label  (pure, exported)
   *
   * 5-stop diverging scale:
   *   strong opponent  #991B1B  (lean <= -25)
   *   lean opponent    #EF4444  (-25 < lean < -TOSSUP_BAND)
   *   tossup           #F59E0B  (|lean| <= TOSSUP_BAND)
   *   lean player      #3B82F6  ( TOSSUP_BAND < lean < 25)
   *   strong player    #1E40AF  (lean >= 25)
   * ----------------------------------------------------------------------- */
  const STRONG = 25; // threshold separating "lean" from "strong"

  function leanColor(lean) {
    const l = num(lean, 0);
    if (l <= -STRONG) return '#991B1B';
    if (l < -TOSSUP_BAND) return '#EF4444';
    if (l <= TOSSUP_BAND) return '#F59E0B';
    if (l < STRONG) return '#3B82F6';
    return '#1E40AF';
  }

  // Contract CSS classes (the page stylesheet may restyle via these).
  function leanClass(lean) {
    const l = num(lean, 0);
    if (l <= -STRONG) return 'is-opponent';
    if (l < -TOSSUP_BAND) return 'is-leanopp';
    if (l <= TOSSUP_BAND) return 'is-tossup';
    if (l < STRONG) return 'is-leanplayer';
    return 'is-player';
  }

  function leanLabel(lean) {
    const l = Math.round(num(lean, 0));
    if (Math.abs(l) <= TOSSUP_BAND) return 'Tossup';
    if (l > 0) return 'Player +' + l;
    return 'Opp +' + Math.abs(l);
  }

  // Pick readable text color (white on dark fills, dark on amber/light).
  function textColorFor(lean) {
    const l = num(lean, 0);
    // Tossup amber is light -> dark text; everything else is saturated -> white.
    return Math.abs(l) <= TOSSUP_BAND ? '#1E3A8A' : '#ffffff';
  }

  /* ----------------------------------------------------------------------- *
   * tally — pure helper, exported.
   * A region's EV go to whoever its lean favors; |lean| <= TOSSUP_BAND => tossup.
   * ----------------------------------------------------------------------- */
  function tally(regions, votesToWin) {
    const list = Array.isArray(regions) ? regions : [];
    let playerEV = 0, oppEV = 0, tossupEV = 0;
    list.forEach(function (r) {
      const ev = Math.max(0, num(r && r.electoralVotes, 0));
      const lean = num(r && r.lean, 0);
      if (Math.abs(lean) <= TOSSUP_BAND) tossupEV += ev;
      else if (lean > 0) playerEV += ev;
      else oppEV += ev;
    });
    return {
      playerEV: playerEV,
      oppEV: oppEV,
      tossupEV: tossupEV,
      votesToWin: isFiniteNum(votesToWin) ? votesToWin : undefined
    };
  }

  /* ----------------------------------------------------------------------- *
   * Tile sizing: map electoral votes -> a square "span" (in grid cells).
   * Bigger states occupy a larger NxN block so AREA scales with EV.
   * ----------------------------------------------------------------------- */
  function spanForEV(ev) {
    const e = num(ev, 0);
    if (e <= 4) return 1;   // small states: 1x1
    if (e <= 10) return 2;  // medium: 2x2
    if (e <= 20) return 3;  // large: 3x3
    return 4;               // mega (CA/TX-scale): 4x4
  }

  /* ----------------------------------------------------------------------- *
   * Bin-packing flow layout.
   * Greedy left-to-right / top-to-bottom placement on a fixed-column grid.
   * Larger tiles are placed first so big blocks find room; small tiles then
   * backfill the gaps. Returns { placements, cols, rows }.
   * ----------------------------------------------------------------------- */
  function packTiles(regions, cols) {
    // Annotate each region with its span and original index, then sort big-first.
    const items = regions.map(function (r, i) {
      return { region: r, span: spanForEV(r.electoralVotes), idx: i };
    });
    // Stable-ish sort: larger spans first, then by EV desc, preserve order on ties.
    items.sort(function (a, b) {
      if (b.span !== a.span) return b.span - a.span;
      const ev = num(b.region.electoralVotes, 0) - num(a.region.electoralVotes, 0);
      if (ev !== 0) return ev;
      return a.idx - b.idx;
    });

    const occupied = {};          // "r,c" -> true
    const key = function (r, c) { return r + ',' + c; };

    function fits(row, col, span) {
      if (col + span > cols) return false;
      for (let r = row; r < row + span; r++) {
        for (let c = col; c < col + span; c++) {
          if (occupied[key(r, c)]) return false;
        }
      }
      return true;
    }
    function occupy(row, col, span) {
      for (let r = row; r < row + span; r++) {
        for (let c = col; c < col + span; c++) occupied[key(r, c)] = true;
      }
    }

    const placements = [];
    let maxRow = 0;

    items.forEach(function (item) {
      const span = item.span;
      // Scan rows top-to-bottom, columns left-to-right for the first fit.
      let placed = false;
      for (let row = 0; !placed && row < 1000; row++) {
        for (let col = 0; col + span <= cols; col++) {
          if (fits(row, col, span)) {
            occupy(row, col, span);
            placements.push({ region: item.region, row: row, col: col, span: span });
            maxRow = Math.max(maxRow, row + span);
            placed = true;
            break;
          }
        }
      }
    });

    return { placements: placements, cols: cols, rows: maxRow };
  }

  // Choose a column count that yields a roughly balanced (wide-ish) grid given
  // the total cell area required by all tiles.
  function chooseCols(regions) {
    let area = 0, maxSpan = 1;
    regions.forEach(function (r) {
      const s = spanForEV(r.electoralVotes);
      area += s * s;
      if (s > maxSpan) maxSpan = s;
    });
    // Aim for a ~1.6:1 (w:h) aspect. cols ≈ sqrt(area * 1.6).
    let cols = Math.ceil(Math.sqrt(area * 1.6));
    cols = Math.max(cols, maxSpan, 4); // never narrower than the biggest tile / a floor
    return cols;
  }

  /* ======================================================================= *
   * create — build the map + return a controller.
   * ======================================================================= */
  function create(container, opts) {
    const node = resolveContainer(container);
    opts = opts || {};

    // Mutable state held by the controller closure.
    let regions = Array.isArray(opts.regions) ? opts.regions.slice() : [];
    let selectedId = null;
    let targetIds = {};                    // id -> true
    const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;
    const onHover = typeof opts.onHover === 'function' ? opts.onHover : null;
    const reduce = prefersReducedMotion(opts);

    // Tile geometry constants (SVG user units).
    const CELL = 56;        // size of one 1x1 grid cell
    const GAP = 6;          // gap between tiles
    const PAD = 8;          // outer padding inside the svg plot

    // Per-render lookup of tile <g> nodes by region id (for fast updates).
    let tileById = {};

    // Root wrapper (we render the svg + a tooltip + legend into it).
    const wrap = document.createElement('div');
    wrap.className = 'map-view';
    wrap.style.position = 'relative';
    wrap.style.width = '100%';

    // Shared tooltip element (HTML overlay).
    const tip = document.createElement('div');
    tip.className = 'region-tooltip';
    tip.setAttribute('role', 'status');
    tip.style.cssText = [
      'position:absolute', 'pointer-events:none', 'z-index:30',
      'background:#1E3A8A', 'color:#fff', 'padding:6px 10px',
      'border-radius:8px', 'font:12px/1.4 var(--body-font,"Fira Sans",sans-serif)',
      'box-shadow:var(--shadow-md,0 4px 6px rgba(0,0,0,0.1))',
      'white-space:nowrap', 'opacity:0', 'transition:opacity 120ms ease',
      'transform:translate(-50%,-120%)'
    ].join(';');

    let svg = null; // current svg element, replaced on each render

    function showTip(text, ev, targetNode) {
      tip.textContent = text;
      tip.style.opacity = '1';
      moveTip(ev, targetNode);
    }
    function moveTip(ev, targetNode) {
      const rect = wrap.getBoundingClientRect();
      let x, y;
      if (ev && typeof ev.clientX === 'number') {
        x = ev.clientX - rect.left; y = ev.clientY - rect.top;
      } else if (targetNode) {
        const tr = targetNode.getBoundingClientRect();
        x = tr.left - rect.left + tr.width / 2; y = tr.top - rect.top;
      } else { return; }
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
    function hideTip() { tip.style.opacity = '0'; }

    function tooltipText(r) {
      return (r.name || r.abbreviation || r.id) +
        ' — ' + num(r.electoralVotes, 0) + ' EV — ' + leanLabel(r.lean);
    }

    /* --- core render: rebuild the svg from current `regions` --- */
    function render() {
      tileById = {};
      const cols = chooseCols(regions);
      const packed = packTiles(regions, cols);
      const rows = Math.max(1, packed.rows);

      const plotW = cols * CELL + (cols - 1) * GAP;
      const plotH = rows * CELL + (rows - 1) * GAP;
      const width = plotW + PAD * 2;
      const height = plotH + PAD * 2;

      const newSvg = el('svg', {
        viewBox: '0 0 ' + width + ' ' + height,
        width: '100%',
        preserveAspectRatio: 'xMidYMid meet',
        class: 'cartogram-map',
        role: 'group',
        'aria-label': opts.ariaLabel || 'Electoral cartogram map'
      });
      newSvg.style.display = 'block';
      newSvg.style.maxWidth = '100%';
      newSvg.appendChild(el('title', null, 'Electoral map'));

      if (!regions.length) {
        newSvg.appendChild(el('text', {
          x: width / 2, y: height / 2, 'text-anchor': 'middle',
          fill: 'var(--color-text,#1E3A8A)', 'font-size': 14
        }, 'No regions'));
      }

      // Cell -> pixel helpers.
      function px(col) { return PAD + col * (CELL + GAP); }
      function py(row) { return PAD + row * (CELL + GAP); }

      packed.placements.forEach(function (p) {
        const r = p.region;
        const x = px(p.col);
        const y = py(p.row);
        const w = p.span * CELL + (p.span - 1) * GAP;
        const h = w; // square tile
        const lean = num(r.lean, 0);
        const fill = leanColor(lean);
        const txtColor = textColorFor(lean);
        const id = r.id != null ? r.id : (r.abbreviation || r.name);

        // Tile group: focusable + interactive.
        const g = el('g', {
          class: 'region-tile ' + leanClass(lean),
          'data-region': id,
          tabindex: 0,
          role: 'button',
          'aria-label': (r.name || r.abbreviation || id) + ', ' +
            num(r.electoralVotes, 0) + ' electoral votes, ' + leanLabel(lean) +
            (selectedId === id ? ', selected' : '')
        });
        g.style.cursor = 'pointer';
        if (!reduce) g.style.transition = 'opacity 150ms ease';

        const rect = el('rect', {
          x: x, y: y, width: w, height: h, rx: 6, ry: 6,
          fill: fill, stroke: '#ffffff', 'stroke-width': 2,
          class: 'region-tile-rect'
        });
        g.appendChild(rect);

        // Abbreviation (centered, upper portion).
        const abbr = r.abbreviation || (r.name ? String(r.name).slice(0, 2).toUpperCase() : '');
        g.appendChild(el('text', {
          x: x + w / 2, y: y + h / 2 - (p.span > 1 ? 4 : 1),
          'text-anchor': 'middle',
          fill: txtColor,
          'font-size': p.span > 1 ? 16 : 13,
          'font-weight': 700,
          'pointer-events': 'none'
        }, abbr));

        // Electoral votes (below abbreviation).
        g.appendChild(el('text', {
          x: x + w / 2, y: y + h / 2 + (p.span > 1 ? 16 : 12),
          'text-anchor': 'middle',
          fill: txtColor,
          'font-size': p.span > 1 ? 12 : 10,
          opacity: 0.92,
          'pointer-events': 'none'
        }, String(num(r.electoralVotes, 0))));

        // --- interaction wiring ---
        function doSelect() {
          setSelected(id);
          if (onSelect) onSelect(id);
        }
        g.addEventListener('click', doSelect);
        g.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            doSelect();
          }
        });
        g.addEventListener('mouseenter', function (ev) {
          g.classList.add('is-hover');
          rect.setAttribute('stroke', '#1E3A8A');
          showTip(tooltipText(r), ev, g);
          if (onHover) onHover(id);
        });
        g.addEventListener('mousemove', function (ev) { moveTip(ev, g); });
        g.addEventListener('mouseleave', function () {
          g.classList.remove('is-hover');
          rect.setAttribute('stroke', '#ffffff');
          hideTip();
        });
        g.addEventListener('focus', function () {
          showTip(tooltipText(r), null, g);
          if (onHover) onHover(id);
        });
        g.addEventListener('blur', hideTip);

        // Apply persistent state classes.
        if (selectedId === id) g.classList.add('is-selected');
        if (targetIds[id]) g.classList.add('is-target');

        tileById[id] = { g: g, rect: rect, region: r };
        newSvg.appendChild(g);
      });

      // Swap the svg into the wrapper.
      if (svg && svg.parentNode === wrap) wrap.removeChild(svg);
      // Insert svg before the tooltip + legend so they overlay/follow correctly.
      wrap.insertBefore(newSvg, tip);
      svg = newSvg;

      renderLegend();
      renderTallyBar();
    }

    /* --- legend explaining the diverging color scale --- */
    let legendEl = null;
    function renderLegend() {
      if (legendEl && legendEl.parentNode === wrap) wrap.removeChild(legendEl);
      legendEl = document.createElement('div');
      legendEl.className = 'map-legend';
      legendEl.setAttribute('aria-label', 'Map color legend');
      legendEl.style.cssText = [
        'display:flex', 'flex-wrap:wrap', 'gap:var(--space-md,16px)',
        'align-items:center', 'margin-top:var(--space-sm,8px)',
        'font:11px/1.3 var(--body-font,"Fira Sans",sans-serif)',
        'color:var(--color-text,#1E3A8A)'
      ].join(';');

      const stops = [
        { c: '#991B1B', t: 'Strong Opp' },
        { c: '#EF4444', t: 'Lean Opp' },
        { c: '#F59E0B', t: 'Tossup' },
        { c: '#3B82F6', t: 'Lean Player' },
        { c: '#1E40AF', t: 'Strong Player' }
      ];
      stops.forEach(function (s) {
        const item = document.createElement('span');
        item.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
        const sw = document.createElement('span');
        sw.style.cssText = 'width:14px;height:14px;border-radius:3px;display:inline-block;background:' + s.c;
        const lbl = document.createElement('span');
        lbl.textContent = s.t;
        item.appendChild(sw);
        item.appendChild(lbl);
        legendEl.appendChild(item);
      });
      wrap.appendChild(legendEl);
    }

    /* --- a small live EV tally readout (player vs opp vs tossup) --- */
    let tallyEl = null;
    function renderTallyBar() {
      if (tallyEl && tallyEl.parentNode === wrap) wrap.removeChild(tallyEl);
      const t = tally(regions, opts.votesToWin);
      tallyEl = document.createElement('div');
      tallyEl.className = 'map-tally';
      tallyEl.setAttribute('role', 'status');
      tallyEl.style.cssText = [
        'display:flex', 'gap:var(--space-lg,24px)', 'margin-top:var(--space-xs,4px)',
        'font:600 12px/1.3 var(--body-font,"Fira Sans",sans-serif)',
        'color:var(--color-text,#1E3A8A)'
      ].join(';');
      tallyEl.innerHTML = '';
      const parts = [
        { label: 'Player', v: t.playerEV, c: '#1E40AF' },
        { label: 'Tossup', v: t.tossupEV, c: '#F59E0B' },
        { label: 'Opp', v: t.oppEV, c: '#991B1B' }
      ];
      parts.forEach(function (p) {
        const span = document.createElement('span');
        span.textContent = p.label + ': ' + p.v + ' EV';
        span.style.color = p.c;
        tallyEl.appendChild(span);
      });
      if (isFiniteNum(opts.votesToWin)) {
        const span = document.createElement('span');
        span.textContent = '(' + opts.votesToWin + ' to win)';
        span.style.opacity = '0.7';
        tallyEl.appendChild(span);
      }
      wrap.appendChild(tallyEl);
    }

    /* ------------------- controller methods ------------------- */

    function update(newRegions) {
      if (Array.isArray(newRegions)) regions = newRegions.slice();
      // Drop selection/targets that no longer exist.
      const ids = {};
      regions.forEach(function (r) { ids[r.id != null ? r.id : (r.abbreviation || r.name)] = true; });
      if (selectedId != null && !ids[selectedId]) selectedId = null;
      Object.keys(targetIds).forEach(function (k) { if (!ids[k]) delete targetIds[k]; });
      render();
    }

    function setSelected(regionId) {
      selectedId = regionId;
      // Update classes + aria in place without a full re-render.
      Object.keys(tileById).forEach(function (id) {
        const t = tileById[id];
        const isSel = id === String(regionId) || id === regionId;
        t.g.classList.toggle('is-selected', isSel);
        const base = (t.region.name || t.region.abbreviation || id) + ', ' +
          num(t.region.electoralVotes, 0) + ' electoral votes, ' + leanLabel(t.region.lean);
        t.g.setAttribute('aria-label', base + (isSel ? ', selected' : ''));
      });
    }

    function highlightTargets(regionIds) {
      targetIds = {};
      (Array.isArray(regionIds) ? regionIds : []).forEach(function (id) { targetIds[id] = true; });
      Object.keys(tileById).forEach(function (id) {
        tileById[id].g.classList.toggle('is-target', !!targetIds[id]);
      });
    }

    function destroy() {
      // Remove all listeners by discarding the DOM subtree, then detach wrapper.
      hideTip();
      clearNode(wrap);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      tileById = {};
      svg = null;
    }

    // Initial mount.
    clearNode(node);
    node.appendChild(wrap);
    wrap.appendChild(tip); // tooltip lives in the wrapper (above the svg z-order)
    render();

    return {
      el: svg,                  // note: reassigned on re-render; see `getSvg`
      getSvg: function () { return svg; },
      root: wrap,
      update: update,
      setSelected: setSelected,
      highlightTargets: highlightTargets,
      destroy: destroy
    };
  }

  /* ----------------------------------------------------------------------- *
   * Public API
   * ----------------------------------------------------------------------- */
  return {
    create: create,
    tally: tally,
    leanClass: leanClass,
    leanColor: leanColor,
    leanLabel: leanLabel
  };
});
