/*!
 * Campaign Trail — Charts
 * Dependency-free, hand-rolled inline SVG charting for the election strategy game.
 *
 * Public API (Campaign.Charts):
 *   lineChart(container, opts) -> <svg>
 *   barChart(container, opts)  -> <svg>
 *   sparkline(container, values, opts) -> <svg>
 *   gauge(container, opts)     -> <svg>
 *   donut(container, opts)     -> <svg>
 *
 * Every render function clears the container then appends a fresh <svg>, so it is
 * idempotent (safe to call repeatedly with new data on state change).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.Campaign = root.Campaign || {}; root.Campaign.Charts = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ----------------------------------------------------------------------- *
   * Small DOM / math helpers
   * ----------------------------------------------------------------------- */

  // Guard: only touch the DOM when a document actually exists. This keeps
  // require() in Node from throwing at load time. Render functions will throw a
  // clear error only when they are actually called without a DOM.
  function ensureDom() {
    if (typeof document === 'undefined') {
      throw new Error('Campaign.Charts requires a DOM (document is undefined).');
    }
  }

  // Create a namespaced SVG element with optional attributes + text content.
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

  // Resolve the container (accept a selector string or an element).
  function resolveContainer(container) {
    ensureDom();
    let node = container;
    if (typeof container === 'string') node = document.querySelector(container);
    if (!node || typeof node.appendChild !== 'function') {
      throw new Error('Campaign.Charts: invalid container.');
    }
    return node;
  }

  // Clear a container's children (idempotent re-render).
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }

  function num(v, fallback) { return isFiniteNum(v) ? v : fallback; }

  // Clamp helper.
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Trim a float to a short, human-friendly string (no trailing zeros).
  function fmt(n) {
    if (!isFiniteNum(n)) return '0';
    const r = Math.round(n * 100) / 100;
    return String(r);
  }

  // Does the user / option prefer reduced motion?
  function prefersReducedMotion(opts) {
    if (opts && opts.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  // Build an SVG path "d" string from an array of [x,y] points.
  function linePath(pts) {
    if (!pts.length) return '';
    let d = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1]);
    for (let i = 1; i < pts.length; i++) d += ' L' + fmt(pts[i][0]) + ' ' + fmt(pts[i][1]);
    return d;
  }

  // Default categorical palette (colorblind-aware ordering, anchored on the
  // project's blue + amber). Used when a series/bar omits an explicit color.
  const PALETTE = ['#1E40AF', '#F59E0B', '#3B82F6', '#0EA5E9', '#7C3AED', '#10B981', '#EF4444'];
  function paletteColor(i) { return PALETTE[i % PALETTE.length]; }

  /* ----------------------------------------------------------------------- *
   * Shared scaffolding: root <svg> with responsive viewBox + a11y.
   * ----------------------------------------------------------------------- */
  function makeSvg(width, height, opts) {
    opts = opts || {};
    const svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width: '100%',
      // Letting CSS control height keeps it responsive; we expose the intrinsic
      // ratio via viewBox. We still set a sensible default via style.
      preserveAspectRatio: 'xMidYMid meet',
      class: 'campaign-chart' + (opts.className ? ' ' + opts.className : ''),
      role: 'img'
    });
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';
    if (opts.ariaLabel) svg.setAttribute('aria-label', opts.ariaLabel);
    const title = el('title', null, opts.title || opts.ariaLabel || 'Chart');
    svg.appendChild(title);
    return svg;
  }

  // Attach a lightweight, dependency-free tooltip to an interactive node.
  // Renders into an HTML overlay positioned relative to the container.
  function attachTooltip(container, target, getText) {
    // Lazily create one shared tooltip element per container.
    let tip = container.__campaignTip;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'campaign-chart-tooltip';
      tip.setAttribute('role', 'status');
      tip.style.cssText = [
        'position:absolute', 'pointer-events:none', 'z-index:20',
        'background:#1E3A8A', 'color:#fff', 'padding:4px 8px',
        'border-radius:6px', 'font:12px/1.4 var(--body-font, "Fira Sans", sans-serif)',
        'box-shadow:var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1))',
        'white-space:nowrap', 'opacity:0', 'transition:opacity 120ms ease',
        'transform:translate(-50%,-115%)'
      ].join(';');
      container.__campaignTip = tip;
    }
    // (Re)attach whenever the tooltip is missing OR was detached by a prior
    // clear()/re-render — otherwise tooltips silently stop working after the
    // first redraw because the cached node lingers detached from the DOM.
    if (!tip.parentNode) {
      const pos = (typeof getComputedStyle === 'function')
        ? getComputedStyle(container).position : 'static';
      if (pos === 'static' || !pos) container.style.position = 'relative';
      container.appendChild(tip);
    }

    function show(ev) {
      tip.textContent = getText();
      tip.style.opacity = '1';
      move(ev);
    }
    function move(ev) {
      // Position relative to container using offset of the pointer.
      const rect = container.getBoundingClientRect();
      let x, y;
      if (ev && typeof ev.clientX === 'number') {
        x = ev.clientX - rect.left;
        y = ev.clientY - rect.top;
      } else {
        // Keyboard focus: center over the target's bbox.
        const tr = target.getBoundingClientRect();
        x = tr.left - rect.left + tr.width / 2;
        y = tr.top - rect.top;
      }
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
    function hide() { tip.style.opacity = '0'; }

    target.addEventListener('mouseenter', show);
    target.addEventListener('mousemove', move);
    target.addEventListener('mouseleave', hide);
    target.addEventListener('focus', show);
    target.addEventListener('blur', hide);
  }

  // Append a visually-hidden data table fallback for screen readers / no-CSS.
  function appendDataTable(container, caption, headers, rows) {
    const table = document.createElement('table');
    table.className = 'campaign-chart-data sr-only';
    // Inline the common "visually hidden" pattern so it works without project CSS.
    table.style.cssText = [
      'position:absolute', 'width:1px', 'height:1px', 'padding:0',
      'margin:-1px', 'overflow:hidden', 'clip:rect(0 0 0 0)',
      'white-space:nowrap', 'border:0'
    ].join(';');
    const cap = document.createElement('caption');
    cap.textContent = caption;
    table.appendChild(cap);
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    headers.forEach(function (h) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(function (r) {
      const tr = document.createElement('tr');
      r.forEach(function (c) {
        const td = document.createElement('td');
        td.textContent = String(c);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  /* ======================================================================= *
   * lineChart
   * ======================================================================= */
  function lineChart(container, opts) {
    const node = resolveContainer(container);
    opts = opts || {};
    clear(node);

    const width = num(opts.width, 640);
    const height = num(opts.height, 320);
    const series = Array.isArray(opts.series) ? opts.series : [];
    const reduce = prefersReducedMotion(opts);

    // Inner plot insets (room for axis labels / legend).
    const padL = 44, padR = 16, padT = 16;
    const padB = (opts.xLabels && opts.xLabels.length ? 34 : 20) +
                 (opts.showLegend === false ? 0 : 24);
    const plotW = Math.max(1, width - padL - padR);
    const plotH = Math.max(1, height - padT - padB);

    // Gather all points to compute domains.
    let allX = [], allY = [];
    series.forEach(function (s) {
      (s.points || []).forEach(function (p) {
        if (isFiniteNum(p.x)) allX.push(p.x);
        if (isFiniteNum(p.y)) allY.push(p.y);
      });
    });

    const ariaLabel = opts.ariaLabel ||
      ('Line chart' + (series.length ? ' of ' + series.map(function (s) { return s.name; }).filter(Boolean).join(', ') : ''));
    const svg = makeSvg(width, height, { ariaLabel: ariaLabel, title: opts.title || ariaLabel, className: 'campaign-line-chart' });

    // Empty-state guard.
    if (!series.length || !allY.length) {
      svg.appendChild(el('text', {
        x: width / 2, y: height / 2, 'text-anchor': 'middle',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 13
      }, 'No data'));
      node.appendChild(svg);
      return svg;
    }

    // Y domain (allow explicit min/max, otherwise derive with a little padding).
    let yMin = isFiniteNum(opts.yMin) ? opts.yMin : Math.min.apply(null, allY);
    let yMax = isFiniteNum(opts.yMax) ? opts.yMax : Math.max.apply(null, allY);
    if (yMin === yMax) { yMin -= 1; yMax += 1; } // avoid divide-by-zero
    // X domain.
    let xMin = allX.length ? Math.min.apply(null, allX) : 0;
    let xMax = allX.length ? Math.max.apply(null, allX) : 1;
    if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }

    function sx(x) { return padL + ((x - xMin) / (xMax - xMin)) * plotW; }
    function sy(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH; }

    // ---- Gridlines + Y axis ticks (5 horizontal lines) ----
    const gridGroup = el('g', { class: 'campaign-grid', 'aria-hidden': 'true' });
    const TICKS = 5;
    for (let i = 0; i <= TICKS; i++) {
      const v = yMin + (i / TICKS) * (yMax - yMin);
      const yy = sy(v);
      gridGroup.appendChild(el('line', {
        x1: padL, y1: yy, x2: padL + plotW, y2: yy,
        stroke: 'var(--color-grid, #E2E8F0)', 'stroke-width': 1
      }));
      gridGroup.appendChild(el('text', {
        x: padL - 6, y: yy + 3, 'text-anchor': 'end',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 10, opacity: 0.7
      }, fmt(v)));
    }
    svg.appendChild(gridGroup);

    // ---- Optional baseline reference (e.g. 50% threshold or 0 momentum) ----
    if (isFiniteNum(opts.baselineY) && opts.baselineY >= yMin && opts.baselineY <= yMax) {
      const by = sy(opts.baselineY);
      svg.appendChild(el('line', {
        x1: padL, y1: by, x2: padL + plotW, y2: by,
        stroke: 'var(--color-text, #1E3A8A)', 'stroke-width': 1.5,
        'stroke-dasharray': '2 4', opacity: 0.55, class: 'campaign-baseline'
      }));
      svg.appendChild(el('text', {
        x: padL + plotW, y: by - 4, 'text-anchor': 'end',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 10, opacity: 0.8
      }, fmt(opts.baselineY)));
    }

    // ---- X axis labels ----
    if (opts.xLabels && opts.xLabels.length) {
      const labels = opts.xLabels;
      const xg = el('g', { class: 'campaign-xaxis', 'aria-hidden': 'true' });
      // Spread labels evenly across the plot width; thin out if crowded.
      const step = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 48)));
      labels.forEach(function (lbl, i) {
        if (i % step !== 0 && i !== labels.length - 1) return;
        const xx = padL + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
        xg.appendChild(el('text', {
          x: xx, y: padT + plotH + 16, 'text-anchor': 'middle',
          fill: 'var(--color-text, #1E3A8A)', 'font-size': 10, opacity: 0.7
        }, lbl));
      });
      svg.appendChild(xg);
    }

    // ---- Each series: optional area fill, line, dot markers ----
    series.forEach(function (s, si) {
      const color = s.color || paletteColor(si);
      const pts = (s.points || [])
        .filter(function (p) { return isFiniteNum(p.x) && isFiniteNum(p.y); })
        .map(function (p) { return { x: p.x, y: p.y, sx: sx(p.x), sy: sy(p.y) }; });
      if (!pts.length) return;

      const xy = pts.map(function (p) { return [p.sx, p.sy]; });
      const g = el('g', { class: 'campaign-series', 'data-series': s.name || ('series-' + si) });

      // Area fill (20% opacity) under the line.
      if (opts.areaFill) {
        const baseY = padT + plotH;
        let d = linePath(xy);
        d += ' L' + fmt(xy[xy.length - 1][0]) + ' ' + fmt(baseY);
        d += ' L' + fmt(xy[0][0]) + ' ' + fmt(baseY) + ' Z';
        g.appendChild(el('path', {
          d: d, fill: color, 'fill-opacity': 0.2, stroke: 'none'
        }));
      }

      // The line itself. Dashed option distinguishes series without relying on
      // color alone (colorblind-friendly).
      const path = el('path', {
        d: linePath(xy), fill: 'none', stroke: color, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.dashed ? '6 5' : null
      });
      g.appendChild(path);

      // Animate line draw-on (skipped under reduced motion).
      if (!reduce && typeof path.getTotalLength === 'function') {
        try {
          const len = path.getTotalLength();
          if (len && isFinite(len)) {
            path.style.transition = 'none';
            path.style.strokeDasharray = (s.dashed ? '6 5, ' : '') + len + ' ' + len;
            path.style.strokeDashoffset = String(len);
            // Force layout then animate.
            // eslint-disable-next-line no-unused-expressions
            path.getBoundingClientRect();
            path.style.transition = 'stroke-dashoffset 600ms ease';
            path.style.strokeDashoffset = '0';
          }
        } catch (e) { /* getTotalLength unsupported in some envs; ignore */ }
      }

      // Dot markers (always available; second redundant channel for a11y).
      if (opts.showDots !== false) {
        pts.forEach(function (p) {
          const dot = el('circle', {
            cx: p.sx, cy: p.sy, r: 3.5, fill: '#fff', stroke: color,
            'stroke-width': 2, class: 'campaign-dot', tabindex: 0,
            role: 'img',
            'aria-label': (s.name ? s.name + ': ' : '') + 'x ' + fmt(p.x) + ', y ' + fmt(p.y)
          });
          dot.style.cursor = 'pointer';
          attachTooltip(node, dot, function () {
            return (s.name ? s.name + ' — ' : '') + fmt(p.y) + (opts.xLabels ? '' : ' @ ' + fmt(p.x));
          });
          g.appendChild(dot);
        });
      }
      svg.appendChild(g);
    });

    // ---- Legend ----
    if (opts.showLegend !== false && series.length) {
      const legend = el('g', { class: 'campaign-legend', role: 'list' });
      let lx = padL;
      const ly = height - 6;
      series.forEach(function (s, si) {
        const color = s.color || paletteColor(si);
        const item = el('g', { role: 'listitem' });
        // swatch line + dot mirrors how the series is drawn (dash awareness)
        item.appendChild(el('line', {
          x1: lx, y1: ly - 4, x2: lx + 18, y2: ly - 4,
          stroke: color, 'stroke-width': 2.5,
          'stroke-dasharray': s.dashed ? '4 3' : null
        }));
        item.appendChild(el('circle', { cx: lx + 9, cy: ly - 4, r: 3, fill: '#fff', stroke: color, 'stroke-width': 2 }));
        const label = el('text', {
          x: lx + 24, y: ly - 1, fill: 'var(--color-text, #1E3A8A)', 'font-size': 11
        }, s.name || ('Series ' + (si + 1)));
        item.appendChild(label);
        legend.appendChild(item);
        // advance x by an estimated width (label length * ~6px + swatch + gap)
        lx += 24 + (String(s.name || '').length * 6) + 28;
      });
      svg.appendChild(legend);
    }

    node.appendChild(svg);

    // ---- Accessible data table fallback ----
    const headers = ['Series'].concat(
      (opts.xLabels && opts.xLabels.length)
        ? opts.xLabels
        : (series[0] && series[0].points ? series[0].points.map(function (_, i) { return 'Point ' + (i + 1); }) : [])
    );
    const rows = series.map(function (s) {
      return [s.name || 'Series'].concat((s.points || []).map(function (p) { return fmt(p.y); }));
    });
    if (rows.length) appendDataTable(node, ariaLabel, headers, rows);

    return svg;
  }

  /* ======================================================================= *
   * barChart
   * ======================================================================= */
  function barChart(container, opts) {
    const node = resolveContainer(container);
    opts = opts || {};
    clear(node);

    let bars = Array.isArray(opts.bars) ? opts.bars.slice() : [];
    const width = num(opts.width, 640);
    const height = num(opts.height, 320);
    const horizontal = !!opts.horizontal;
    const showValues = opts.showValues !== false;

    // Optional descending sort by value (recommended for ranking comparisons).
    if (opts.sorted) bars.sort(function (a, b) { return num(b.value, 0) - num(a.value, 0); });

    const ariaLabel = opts.ariaLabel || 'Bar chart';
    const svg = makeSvg(width, height, { ariaLabel: ariaLabel, title: opts.title || ariaLabel, className: 'campaign-bar-chart' });

    if (!bars.length) {
      svg.appendChild(el('text', {
        x: width / 2, y: height / 2, 'text-anchor': 'middle',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 13
      }, 'No data'));
      node.appendChild(svg);
      return svg;
    }

    const values = bars.map(function (b) { return num(b.value, 0); });
    // Domain max: explicit, else max value (never below 0 so bars sit on a baseline).
    let maxV = isFiniteNum(opts.max) ? opts.max : Math.max.apply(null, values);
    if (maxV <= 0) maxV = 1;

    const n = bars.length;

    if (horizontal) {
      // Horizontal bars: labels on the left, value labels at bar end.
      const padL = 90, padR = showValues ? 44 : 12, padT = 10, padB = 10;
      const plotW = Math.max(1, width - padL - padR);
      const plotH = Math.max(1, height - padT - padB);
      const band = plotH / n;
      const barH = Math.min(band * 0.7, 40);

      bars.forEach(function (b, i) {
        const v = num(b.value, 0);
        const color = b.color || paletteColor(i);
        const y = padT + band * i + (band - barH) / 2;
        const w = (clamp(v, 0, maxV) / maxV) * plotW;
        const g = el('g', { class: 'campaign-bar', tabindex: 0, role: 'img',
          'aria-label': (b.label || 'Bar') + ': ' + fmt(v) });
        g.style.cursor = 'default';
        g.appendChild(el('rect', {
          x: padL, y: y, width: w, height: barH, rx: 4, fill: color
        }));
        // Category label (left).
        g.appendChild(el('text', {
          x: padL - 8, y: y + barH / 2 + 3, 'text-anchor': 'end',
          fill: 'var(--color-text, #1E3A8A)', 'font-size': 11
        }, b.label || ''));
        // Value label (right of bar).
        if (showValues) {
          g.appendChild(el('text', {
            x: padL + w + 6, y: y + barH / 2 + 3, 'text-anchor': 'start',
            fill: 'var(--color-text, #1E3A8A)', 'font-size': 11, 'font-weight': 600
          }, fmt(v)));
        }
        attachTooltip(node, g, function () { return (b.label || '') + ': ' + fmt(v); });
        svg.appendChild(g);
      });
    } else {
      // Vertical columns: labels under each bar.
      const padL = 28, padR = 12, padT = showValues ? 20 : 10, padB = 28;
      const plotW = Math.max(1, width - padL - padR);
      const plotH = Math.max(1, height - padT - padB);
      const band = plotW / n;
      const barW = Math.min(band * 0.7, 64);

      // Baseline.
      svg.appendChild(el('line', {
        x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH,
        stroke: 'var(--color-grid, #E2E8F0)', 'stroke-width': 1, 'aria-hidden': 'true'
      }));

      bars.forEach(function (b, i) {
        const v = num(b.value, 0);
        const color = b.color || paletteColor(i);
        const x = padL + band * i + (band - barW) / 2;
        const h = (clamp(v, 0, maxV) / maxV) * plotH;
        const y = padT + plotH - h;
        const g = el('g', { class: 'campaign-bar', tabindex: 0, role: 'img',
          'aria-label': (b.label || 'Bar') + ': ' + fmt(v) });
        g.style.cursor = 'default';
        g.appendChild(el('rect', {
          x: x, y: y, width: barW, height: h, rx: 4, fill: color
        }));
        if (showValues) {
          g.appendChild(el('text', {
            x: x + barW / 2, y: y - 5, 'text-anchor': 'middle',
            fill: 'var(--color-text, #1E3A8A)', 'font-size': 11, 'font-weight': 600
          }, fmt(v)));
        }
        // Category label (bottom).
        g.appendChild(el('text', {
          x: x + barW / 2, y: padT + plotH + 16, 'text-anchor': 'middle',
          fill: 'var(--color-text, #1E3A8A)', 'font-size': 10, opacity: 0.8
        }, b.label || ''));
        attachTooltip(node, g, function () { return (b.label || '') + ': ' + fmt(v); });
        svg.appendChild(g);
      });
    }

    node.appendChild(svg);
    appendDataTable(node, ariaLabel, ['Category', 'Value'],
      bars.map(function (b) { return [b.label || '', fmt(num(b.value, 0))]; }));
    return svg;
  }

  /* ======================================================================= *
   * sparkline — tiny inline trend, no axes/labels.
   * ======================================================================= */
  function sparkline(container, values, opts) {
    const node = resolveContainer(container);
    opts = opts || {};
    clear(node);

    const data = (Array.isArray(values) ? values : []).filter(isFiniteNum);
    const width = num(opts.width, 120);
    const height = num(opts.height, 32);
    const color = opts.color || 'var(--color-secondary, #3B82F6)';

    const svg = makeSvg(width, height, {
      ariaLabel: opts.ariaLabel || 'Sparkline trend',
      title: opts.title || 'Trend',
      className: 'campaign-sparkline'
    });

    if (data.length < 2) {
      // With <2 points there is no line to draw; show a flat midline.
      svg.appendChild(el('line', {
        x1: 2, y1: height / 2, x2: width - 2, y2: height / 2,
        stroke: color, 'stroke-width': 1.5, opacity: 0.4
      }));
      node.appendChild(svg);
      return svg;
    }

    const pad = 2;
    let lo = Math.min.apply(null, data);
    let hi = Math.max.apply(null, data);
    if (lo === hi) { lo -= 1; hi += 1; }
    const stepX = (width - pad * 2) / (data.length - 1);
    const xy = data.map(function (v, i) {
      return [pad + i * stepX, pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2)];
    });

    // Optional area fill.
    if (opts.fillColor) {
      let d = linePath(xy);
      d += ' L' + fmt(xy[xy.length - 1][0]) + ' ' + fmt(height - pad);
      d += ' L' + fmt(xy[0][0]) + ' ' + fmt(height - pad) + ' Z';
      svg.appendChild(el('path', { d: d, fill: opts.fillColor, 'fill-opacity': 0.2, stroke: 'none' }));
    }

    svg.appendChild(el('path', {
      d: linePath(xy), fill: 'none', stroke: color, 'stroke-width': 1.75,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    // Emphasize the last point (current value).
    const last = xy[xy.length - 1];
    svg.appendChild(el('circle', { cx: last[0], cy: last[1], r: 2.25, fill: color }));

    node.appendChild(svg);
    return svg;
  }

  /* ======================================================================= *
   * gauge — semicircular 0..100-style gauge.
   * ======================================================================= */

  // Convert a polar point on a circle (degrees, 0 = +x axis, CCW) to cartesian.
  // We work in the upper semicircle: angle 180 (left) -> 0 (right).
  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  }

  // SVG arc path between two angles (degrees) along radius r.
  function arcPath(cx, cy, r, startDeg, endDeg) {
    const a = polar(cx, cy, r, startDeg);
    const b = polar(cx, cy, r, endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    // sweep flag 0 because angle decreases (CW) as value increases left->right.
    const sweep = startDeg > endDeg ? 1 : 0;
    return 'M' + fmt(a[0]) + ' ' + fmt(a[1]) +
      ' A' + fmt(r) + ' ' + fmt(r) + ' 0 ' + large + ' ' + sweep + ' ' + fmt(b[0]) + ' ' + fmt(b[1]);
  }

  function gauge(container, opts) {
    const node = resolveContainer(container);
    opts = opts || {};
    clear(node);

    const min = num(opts.min, 0);
    const max = num(opts.max, 100);
    const range = (max - min) || 1;
    const value = clamp(num(opts.value, min), min, max);
    const frac = (value - min) / range; // 0..1
    const reduce = prefersReducedMotion(opts);

    const width = num(opts.width, 200);
    const height = num(opts.height, 130);
    const cx = width / 2;
    const cy = height - 18;       // baseline a little above bottom for label
    const r = Math.min(width / 2, height - 28) - 8;
    const sw = Math.max(8, r * 0.22); // arc stroke width

    // Angle mapping: value min -> 180deg (left), value max -> 0deg (right).
    function angleFor(f) { return 180 - 180 * clamp(f, 0, 1); }

    const ariaLabel = (opts.label ? opts.label + ': ' : '') + fmt(value) + ' of ' + fmt(max);
    const svg = makeSvg(width, height, { ariaLabel: ariaLabel, title: opts.title || ariaLabel, className: 'campaign-gauge' });
    svg.setAttribute('role', 'img');

    // Track (full background arc).
    svg.appendChild(el('path', {
      d: arcPath(cx, cy, r, 180, 0), fill: 'none',
      stroke: 'var(--color-grid, #E2E8F0)', 'stroke-width': sw, 'stroke-linecap': 'round'
    }));

    // Determine the value color. If thresholds are supplied, pick the color of
    // the highest threshold whose `at` the value has reached.
    let valColor = opts.color || 'var(--color-secondary, #3B82F6)';
    if (Array.isArray(opts.thresholds) && opts.thresholds.length) {
      const sorted = opts.thresholds.slice().sort(function (a, b) { return num(a.at, 0) - num(b.at, 0); });
      sorted.forEach(function (t) { if (value >= num(t.at, -Infinity) && t.color) valColor = t.color; });

      // Draw subtle threshold tick marks on the track for context.
      sorted.forEach(function (t) {
        const tf = (num(t.at, min) - min) / range;
        if (tf < 0 || tf > 1) return;
        const aIn = polar(cx, cy, r - sw / 2, angleFor(tf));
        const aOut = polar(cx, cy, r + sw / 2, angleFor(tf));
        svg.appendChild(el('line', {
          x1: aIn[0], y1: aIn[1], x2: aOut[0], y2: aOut[1],
          stroke: '#fff', 'stroke-width': 2, opacity: 0.9, 'aria-hidden': 'true'
        }));
      });
    }

    // Value arc.
    const valPath = el('path', {
      d: arcPath(cx, cy, r, 180, angleFor(frac)), fill: 'none',
      stroke: valColor, 'stroke-width': sw, 'stroke-linecap': 'round',
      class: 'campaign-gauge-value'
    });
    svg.appendChild(valPath);

    // Animate fill (stroke-dashoffset) unless reduced motion.
    if (!reduce && typeof valPath.getTotalLength === 'function') {
      try {
        const len = valPath.getTotalLength();
        if (len && isFinite(len)) {
          valPath.style.strokeDasharray = len + ' ' + len;
          valPath.style.strokeDashoffset = String(len);
          // eslint-disable-next-line no-unused-expressions
          valPath.getBoundingClientRect();
          valPath.style.transition = 'stroke-dashoffset 700ms ease';
          valPath.style.strokeDashoffset = '0';
        }
      } catch (e) { /* ignore */ }
    }

    // Center value text.
    svg.appendChild(el('text', {
      x: cx, y: cy - 4, 'text-anchor': 'middle',
      fill: 'var(--color-text, #1E3A8A)', 'font-size': Math.max(16, r * 0.42),
      'font-weight': 700
    }, fmt(value)));

    // Label below value.
    if (opts.label) {
      svg.appendChild(el('text', {
        x: cx, y: cy + 12, 'text-anchor': 'middle',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 11, opacity: 0.75
      }, opts.label));
    }

    // Min/max endpoints.
    svg.appendChild(el('text', { x: cx - r, y: cy + 12, 'text-anchor': 'middle',
      fill: 'var(--color-text, #1E3A8A)', 'font-size': 9, opacity: 0.55 }, fmt(min)));
    svg.appendChild(el('text', { x: cx + r, y: cy + 12, 'text-anchor': 'middle',
      fill: 'var(--color-text, #1E3A8A)', 'font-size': 9, opacity: 0.55 }, fmt(max)));

    node.appendChild(svg);
    return svg;
  }

  /* ======================================================================= *
   * donut — part-to-whole with center label.
   * ======================================================================= */
  function donut(container, opts) {
    const node = resolveContainer(container);
    opts = opts || {};
    clear(node);

    const segments = (Array.isArray(opts.segments) ? opts.segments : [])
      .filter(function (s) { return isFiniteNum(s.value) && s.value > 0; });
    const width = num(opts.width, 220);
    const height = num(opts.height, width);
    const reduce = prefersReducedMotion(opts);

    const ariaLabel = opts.ariaLabel || 'Donut chart';
    const svg = makeSvg(width, height, { ariaLabel: ariaLabel, title: opts.title || ariaLabel, className: 'campaign-donut' });

    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2 - 6;
    const inner = r * 0.62;
    const ringW = r - inner;
    const midR = (r + inner) / 2;

    const total = segments.reduce(function (a, s) { return a + s.value; }, 0);

    if (!segments.length || total <= 0) {
      svg.appendChild(el('circle', {
        cx: cx, cy: cy, r: midR, fill: 'none',
        stroke: 'var(--color-grid, #E2E8F0)', 'stroke-width': ringW
      }));
      svg.appendChild(el('text', {
        x: cx, y: cy + 4, 'text-anchor': 'middle',
        fill: 'var(--color-text, #1E3A8A)', 'font-size': 12
      }, 'No data'));
      node.appendChild(svg);
      return svg;
    }

    // Draw each segment as a stroked arc on a circle (using the full-circle
    // arc-path helper repurposed for general angles).
    function ringArc(startDeg, endDeg) {
      const a = polar(cx, cy, midR, startDeg);
      const b = polar(cx, cy, midR, endDeg);
      const delta = startDeg - endDeg; // going clockwise as angle decreases
      const large = Math.abs(delta) > 180 ? 1 : 0;
      return 'M' + fmt(a[0]) + ' ' + fmt(a[1]) +
        ' A' + fmt(midR) + ' ' + fmt(midR) + ' 0 ' + large + ' 1 ' + fmt(b[0]) + ' ' + fmt(b[1]);
    }

    let startDeg = 90; // begin at top, sweep clockwise
    segments.forEach(function (s, i) {
      const frac = s.value / total;
      // Full-circle single segment needs special handling (arc can't be 360).
      let endDeg = startDeg - frac * 360;
      const color = s.color || paletteColor(i);

      let shape;
      if (frac >= 0.9999) {
        // Single full segment: draw a complete ring instead of an arc.
        shape = el('circle', {
          cx: cx, cy: cy, r: midR, fill: 'none', stroke: color, 'stroke-width': ringW
        });
      } else {
        shape = el('path', {
          d: ringArc(startDeg, endDeg), fill: 'none', stroke: color,
          'stroke-width': ringW
        });
      }
      shape.setAttribute('class', 'campaign-donut-seg');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('role', 'img');
      const pct = Math.round(frac * 1000) / 10;
      shape.setAttribute('aria-label', (s.label || ('Segment ' + (i + 1))) + ': ' + fmt(s.value) + ' (' + pct + '%)');
      shape.style.cursor = 'pointer';
      attachTooltip(node, shape, function () {
        return (s.label || '') + ': ' + fmt(s.value) + ' (' + pct + '%)';
      });

      if (!reduce) shape.style.transition = 'stroke-width 150ms ease';
      svg.appendChild(shape);
      startDeg = endDeg;
    });

    // Center label.
    if (opts.centerLabel != null) {
      const lines = String(opts.centerLabel).split('\n');
      const baseY = cy + 5 - (lines.length - 1) * 8;
      lines.forEach(function (ln, i) {
        svg.appendChild(el('text', {
          x: cx, y: baseY + i * 16, 'text-anchor': 'middle',
          fill: 'var(--color-text, #1E3A8A)',
          'font-size': i === 0 ? 18 : 11,
          'font-weight': i === 0 ? 700 : 400,
          opacity: i === 0 ? 1 : 0.7
        }, ln));
      });
    }

    node.appendChild(svg);
    appendDataTable(node, ariaLabel, ['Segment', 'Value', 'Share %'],
      segments.map(function (s) {
        return [s.label || '', fmt(s.value), (Math.round((s.value / total) * 1000) / 10) + '%'];
      }));
    return svg;
  }

  /* ----------------------------------------------------------------------- *
   * Public API
   * ----------------------------------------------------------------------- */
  return {
    lineChart: lineChart,
    barChart: barChart,
    sparkline: sparkline,
    gauge: gauge,
    donut: donut
  };
});
