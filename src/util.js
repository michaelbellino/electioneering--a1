/*
 * Campaign Trail — small pure utility/format helpers.
 * UMD: window.Campaign.Util in browser, require() in Node.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.Campaign = root.Campaign || {}; root.Campaign.Util = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round = (v, dp) => { const m = Math.pow(10, dp || 0); return Math.round(v * m) / m; };
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const sum = (arr, f) => arr.reduce((s, x, i) => s + (f ? f(x, i) : x), 0);
  const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : 0);

  // 12345678 -> "12.3M" (compact); used in tight KPI chips
  function formatMoney(v) {
    const n = Math.round(Number(v) || 0);
    const abs = Math.abs(n);
    const s = n < 0 ? '-' : '';
    if (abs >= 1e9) return s + trimZero((abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)) + 'B';
    if (abs >= 1e6) return s + trimZero((abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)) + 'M';
    if (abs >= 1e3) return s + trimZero((abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)) + 'K';
    return s + String(abs);
  }
  function trimZero(str) { return String(str).replace(/\.0$/, ''); }

  // 12345678 -> "$12,345,678" (full); used in detail tooltips
  function formatMoneyFull(v) {
    const n = Math.round(Number(v) || 0);
    return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
  }

  const formatSigned = (v) => (v > 0 ? '+' : '') + round(v, 1);
  const pct = (v) => Math.round(v) + '%';

  // Human label for a region lean value in [-100, +100]
  function leanLabel(lean) {
    const a = Math.abs(lean);
    const side = lean > 0 ? 'You' : 'Opp';
    if (a <= 3) return 'Tossup';
    const mag = a >= 35 ? 'Safe' : a >= 15 ? 'Likely' : 'Lean';
    return mag + ' ' + side + ' +' + Math.round(a);
  }

  // CSS state class for a lean value (matches the map/tile contract)
  function leanClass(lean) {
    if (lean >= 35) return 'is-player';
    if (lean >= 4) return 'is-leanplayer';
    if (lean > -4) return 'is-tossup';
    if (lean > -35) return 'is-leanopp';
    return 'is-opponent';
  }

  return { clamp, lerp, round, sign, sum, avg, formatMoney, formatMoneyFull, formatSigned, pct, leanLabel, leanClass };
});
