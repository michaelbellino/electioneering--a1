/*
 * Campaign Trail — deterministic seeded RNG
 * UMD: works as a <script> (window.Campaign.RNG) and via require() in Node.
 *
 * Every random draw in the game flows through a seeded generator so that a
 * given (seed) reproduces an identical playthrough. This is what makes the
 * engine testable: headless simulations are deterministic and replayable.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.Campaign = root.Campaign || {}; root.Campaign.RNG = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // FNV-1a string hash -> 32-bit seed
  function xfnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }

  // mulberry32 PRNG — fast, tiny, good distribution for game use
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Create a seeded RNG instance.
   * @param {string|number} seed
   */
  function create(seed) {
    const seedStr = String(seed == null ? 'campaign-trail' : seed);
    const rand = mulberry32(xfnv1a(seedStr));

    const api = {
      seed: seedStr,
      /** float in [0,1) */
      next() { return rand(); },
      /** float in [min,max) */
      float(min, max) { return min + (max - min) * rand(); },
      /** integer in [min,max] inclusive */
      int(min, max) { return Math.floor(min + (max - min + 1) * rand()); },
      /** boolean true with probability p (default 0.5) */
      bool(p) { return rand() < (p == null ? 0.5 : p); },
      /** true with probability p */
      chance(p) { return rand() < p; },
      /** uniform random element of arr */
      pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
      /** Fisher-Yates shuffle (returns a new array) */
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      /**
       * Weighted random pick.
       * @param {Array} items
       * @param {function} [weightFn] item -> weight; defaults to item.weight || item.triggerWeight || 1
       */
      weightedPick(items, weightFn) {
        if (!items || items.length === 0) return undefined;
        let total = 0;
        const weights = new Array(items.length);
        for (let i = 0; i < items.length; i++) {
          const w = Math.max(0, weightFn ? weightFn(items[i], i)
            : (items[i].weight != null ? items[i].weight
              : (items[i].triggerWeight != null ? items[i].triggerWeight : 1)));
          weights[i] = w; total += w;
        }
        if (total <= 0) return items[Math.floor(rand() * items.length)];
        let r = rand() * total;
        for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
        return items[items.length - 1];
      },
      /** normally-distributed value via Box-Muller */
      gaussian(mean, sd) {
        let u = 0, v = 0;
        while (u === 0) u = rand();
        while (v === 0) v = rand();
        const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        return (mean || 0) + (sd == null ? 1 : sd) * n;
      },
      /** derive an independent child RNG (deterministic given parent stream position) */
      fork(tag) { return create(seedStr + '::' + (tag == null ? '' : tag) + '::' + Math.floor(rand() * 1e9)); },
    };
    return api;
  }

  return { create, xfnv1a };
});
