/*
 * Campaign Trail — browser layout regression guard (real Chromium via Playwright).
 *
 *   npm run test:layout      (or: node test/layout.e2e.mjs)
 *
 * jsdom/node tests prove the game LOGIC and that screens render, but they do not
 * do CSS layout, so they cannot catch layout regressions. This test loads the
 * real page in headless Chromium and asserts the start screen is usable:
 *   - the candidate cards lay out as a ROW (not a collapsed single narrow column),
 *   - the primary "Launch campaign" CTA is within the viewport on load,
 *   - the hero is not clipped above a non-scrollable edge,
 *   - there is no horizontal page overflow,
 *   - and the cards STACK to a single column on a phone-width viewport.
 *
 * It SELF-SKIPS (exit 0) when Playwright or a Chromium binary is unavailable, so
 * it never fails an environment that has no browser (e.g. the default fast CI).
 * Provide a browser with `npx playwright install chromium` or PW_CHROMIUM_BIN=/path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file://' + path.join(ROOT, 'index.html');

function skip(reason) {
  console.log('SKIP  layout.e2e — ' + reason);
  console.log('      (provide a browser with `npx playwright install chromium` or PW_CHROMIUM_BIN=/path/to/chrome)');
  process.exit(0);
}

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { skip('playwright-core is not installed'); }

function resolveExecutable() {
  if (process.env.PW_CHROMIUM_BIN && fs.existsSync(process.env.PW_CHROMIUM_BIN)) return process.env.PW_CHROMIUM_BIN;
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch { /* not installed via playwright */ }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const dir of fs.readdirSync(base)) {
      if (!/^chromium-/.test(dir)) continue;
      const exe = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* no browsers dir */ }
  return null;
}

const executablePath = resolveExecutable();
if (!executablePath) skip('no Chromium binary found');

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, expectRow: true },
  { name: 'laptop-1280', width: 1280, height: 800, expectRow: true },
  { name: 'mobile-390', width: 390, height: 780, expectRow: false },
];

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--allow-file-access-from-files'] });
let failures = 0;
const log = (ok, label, extra) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  [${label}]` + (ok ? '' : `  ${extra}`)); };

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const tops = [...document.querySelectorAll('.candidate-card')].map((e) => Math.round(e.getBoundingClientRect().top));
      const grid = document.querySelector('.candidate-grid');
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      const hero = document.querySelector('.screen__hero');
      const launch = [...document.querySelectorAll('button')].find((b) => /launch campaign/i.test(b.textContent || ''));
      const lr = launch && launch.getBoundingClientRect();
      return {
        count: tops.length, tops, cols,
        heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
        launchVisible: lr ? (lr.top >= 0 && lr.top < window.innerHeight && lr.bottom <= window.innerHeight + 1) : false,
        hOverflow: de.scrollWidth > de.clientWidth + 2,
        vw: window.innerWidth,
      };
    });
    const sameRow = m.tops.length >= 2 && m.tops.every((t) => Math.abs(t - m.tops[0]) < 30);
    log(m.count === 3, `${vp.name}: three candidate cards render`, `count=${m.count}`);
    log(!m.hOverflow, `${vp.name}: no horizontal page overflow`, `vw=${m.vw}`);
    if (vp.expectRow) {
      log(sameRow && m.cols >= 2, `${vp.name}: candidate cards laid out as a row`, `cols=${m.cols} tops=${JSON.stringify(m.tops)}`);
      log(m.heroTop !== null && m.heroTop >= -1, `${vp.name}: hero not clipped above the viewport`, `heroTop=${m.heroTop}`);
      log(m.launchVisible, `${vp.name}: "Launch campaign" CTA within the viewport on load`, `(not visible)`);
    } else {
      log(m.cols === 1, `${vp.name}: candidate cards stack to one column`, `cols=${m.cols}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `\n*** layout.e2e: ${failures} check(s) FAILED ***` : '\nlayout.e2e: PASS — start screen layout is usable across viewports.');
process.exit(failures ? 1 : 0);
