# Campaign Trail — Visual System

A turn-based election-campaign strategy game styled as a dark **"campaign war room"**
dashboard. This document describes the design tokens, palette, typography, and the
class contract implemented in `assets/css/styles.css`. The stylesheet is pure
hand-written CSS — no Tailwind, no build step, no external framework (only a Google
Fonts `@import`).

Design intelligence was sourced from the persisted design system
(`design-system/campaign-trail/MASTER.md`) and the `ui-ux-pro-max` skill (Dark Mode /
OLED + Glassmorphism styles, Analytics/Financial Dashboard palettes, UX accessibility
and interaction rules).

---

## 1. Token System

All tokens live in `:root` as CSS custom properties. Nothing in the stylesheet uses a
hard-coded color, spacing, radius, shadow, or duration outside this block (status
tint backgrounds use inline `rgba()` derived from the named hexes).

### Colors — brand & party

| Token | Value | Role |
|-------|-------|------|
| `--color-primary` | `#1E40AF` | Player / brand campaign blue (deep) |
| `--color-primary-bright` | `#3B82F6` | Player blue (bright) — lean-player, links, sparks |
| `--color-opponent` | `#DC2626` | Opponent red (deep) |
| `--color-opponent-bright` | `#EF4444` | Opponent red (bright) — lean-opponent |
| `--color-accent` | `#F59E0B` | Amber accent / primary CTA |
| `--color-accent-deep` | `#D97706` | Amber pressed state |
| `--color-tossup` | `#64748B` | Tossup / neutral slate |

### Colors — status

| Token | Value | Role |
|-------|-------|------|
| `--color-good` | `#22C55E` | Positive / success / gaining |
| `--color-warn` | `#F59E0B` | Caution |
| `--color-bad` | `#EF4444` | Negative / danger / losing |
| `--color-info` | `#3B82F6` | Informational |

### Colors — surfaces (dark)

| Token | Value | Role |
|-------|-------|------|
| `--bg-midnight` | `#0A0E27` | App background (deepest) |
| `--bg-panel` | `#121831` | Panels / cards |
| `--bg-panel-2` | `#1A2142` | Raised panel / hover surface |
| `--bg-sunken` | `#070B1E` | Sunken tracks / deep-black accents |
| `--bg-glass` | `rgba(18,24,49,0.72)` | Glass surface base (header) |

No surface is pure white — the war-room aesthetic stays dark throughout.

### Colors — text (WCAG AA on dark)

| Token | Value | Role | Contrast vs `#0A0E27` |
|-------|-------|------|-----------------------|
| `--text-heading` | `#F8FAFC` | Headings | ~16:1 |
| `--text-body` | `#E2E8F0` | Body | ~12:1 |
| `--text-muted` | `#94A3B8` | Muted — large/secondary text only | ~6:1 |
| `--text-faint` | `#64748B` | Decorative / disabled hints | (non-text use) |
| `--text-on-accent` | `#1A1505` | Dark text on amber CTA | AA on `#F59E0B` |
| `--text-on-bright` | `#FFFFFF` | White on saturated blue/red | AA+ |

### Borders

`--border` `rgba(148,163,184,0.16)` · `--border-strong` `rgba(148,163,184,0.32)` ·
`--border-glass` `rgba(226,232,240,0.10)`.

### Spacing scale

`--sp-1` 4px · `--sp-2` 8px · `--sp-3` 12px · `--sp-4` 16px · `--sp-5` 24px ·
`--sp-6` 32px · `--sp-7` 48px · `--sp-8` 64px.

### Radii

`--radius-sm` 6px · `--radius-md` 10px · `--radius-lg` 16px · `--radius-pill` 999px.

### Shadows (tuned darker for dark surfaces)

`--shadow-sm` · `--shadow-md` · `--shadow-lg` · `--shadow-xl` ·
`--shadow-focus` (`0 0 0 3px rgba(59,130,246,0.55)` focus ring) ·
`--glow-accent` (amber glow for CTAs / selection).

### Font sizes & line heights

`--fs-xs` 12px · `--fs-sm` 14px · `--fs-base` 16px · `--fs-md` 18px · `--fs-lg` 22px ·
`--fs-xl` 28px · `--fs-2xl` 36px · `--fs-3xl` 48px.
`--lh-tight` 1.2 · `--lh-snug` 1.4 · `--lh-body` 1.6.

### Transition durations

`--t-fast` 150ms · `--t-base` 200ms · `--t-slow` 300ms · `--ease` `cubic-bezier(0.4,0,0.2,1)`.
All in the 150–300ms micro-interaction window.

### Z-index scale

`--z-base` 0 · `--z-raised` 10 · `--z-sticky` 20 · `--z-overlay` 30 ·
`--z-modal` 50 · `--z-toast` 60.

### Layout dimensions

`--topbar-h` 64px (56px on mobile) · `--sidebar-w` 280px · `--rightrail-w` 320px.

---

## 2. Typography

```css
--font-mono: 'Fira Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
--font-body: 'Fira Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

- **Headings and all numbers/stats** use `--font-mono` (Fira Code) with
  `font-variant-numeric: tabular-nums` so KPI values, costs, electoral votes, and the
  turn counter align in columns.
- **Body copy** uses `--font-body` (Fira Sans).
- Fonts are loaded via a single Google Fonts `@import` at the top of the stylesheet
  with `&display=swap` (`font-display: swap`). If the import fails offline, the
  fallback stacks (`ui-monospace` / `system-ui`) render a clean, on-brand result.
- Body text never drops below 16px; minimum on-mobile body remains 16px.

---

## 3. Aesthetic Notes

- **Dark "war room" by default** — midnight base with subtle blue/red radial depth
  gradients (player vs opponent) that fall back to flat color.
- **Glassmorphism** on the sticky header (`backdrop-filter: blur(14px)`, subtle 1px
  border) and the modal backdrop, per the skill's glass guidance, while keeping text
  contrast ≥ 4.5:1.
- **Minimal glow** (amber) reserved for CTAs, selection, and the 270 needle — not
  applied broadly, matching the OLED dark-mode guidance.
- **No emoji** anywhere. Iconography is CSS-drawn (the brand star via `clip-path`,
  delta arrows and log markers via `content` glyphs).

---

## 4. Class Contract

The stylesheet implements exactly the following class names (a fixed contract the rest
of the app depends on). State/modifier classes are listed beside their base.

**Layout** — `.app`, `.app__header`, `.app__main` (CSS grid), `.app__sidebar`,
`.app__center`, `.app__rightrail`, `.topbar`, `.topbar__brand`, `.topbar__turn`,
`.kpi-bar`.

**KPI** — `.kpi-card`, `.kpi-card__label`, `.kpi-card__value`, `.kpi-card__delta`
(`.is-up` / `.is-down` / `.is-flat`), `.kpi-card__spark`.

**Panels** — `.panel`, `.panel__title`, `.panel__body`, `.panel__footer`.

**Buttons** — `.btn` (`.btn--primary`, `.btn--accent`, `.btn--ghost`, `.btn--danger`,
`.btn--sm`, `.btn--block`) with `:hover`, `:focus-visible` (visible ring), `:active`,
`[disabled]`/`:disabled`, and `.is-loading` (CSS spinner). Min touch target 44×44px;
`cursor: pointer`.

**Actions** — `.action-card`, `.action-card__head`, `.action-card__name`,
`.action-card__cost`, `.action-card__desc`, `.action-card.is-disabled`,
`.action-card.is-selected`.

**Map** — `.map`, `.map__svg`, `.region-tile` (`.is-player`, `.is-leanplayer`,
`.is-tossup`, `.is-leanopp`, `.is-opponent`, `.is-selected`, `.is-target`),
`.map-legend`, `.map-legend__item`, `.region-tile__label`, `.region-tile__ev`.

**Meters / progress** — `.meter`, `.meter__track`, `.meter__fill`
(`.is-good` / `.is-warn` / `.is-bad`), `.ec-bar`, `.ec-bar__player`, `.ec-bar__opp`,
`.ec-bar__undecided`, `.ec-bar__needle`.

**Modal** — `.modal`, `.modal__backdrop`, `.modal__card`, `.modal__title`,
`.modal__body`, `.modal__actions`, `.event-choice` (+ `:hover`),
`.event-choice__label`, `.event-choice__preview`.

**Misc** — `.badge` (`.is-good` / `.is-warn` / `.is-bad` / `.is-info`), `.toast`
(`.is-good` / `.is-bad`), `.tooltip` (uses `data-tooltip` attribute), `.tabs`, `.tab`
(`.is-active`), `.chart`, `.log`, `.log-entry` (`.is-good` / `.is-bad` / `.is-neutral`),
`.screen` (`.screen--start` / `.screen--win` / `.screen--lose`), `.candidate-card`
(`.is-selected`), `.difficulty-pill` (`.is-active`), `.visually-hidden`.

**Utility animations** — `.anim-countup`, `.anim-pulse`.

### Usage notes for the UI author

- `.region-tile` styles SVG `fill`/`stroke` (intended for `<path>`/`<g>` in
  `.map__svg`); allegiance and selection are also conveyed by `.region-tile__label`
  text and dashed/solid strokes, never by color alone.
- `.ec-bar__needle` defaults to `left: 50%`; set its `left` (or that of the segments'
  `width`) inline to reflect the live count. Its `::after` renders the "270" marker.
- `.kpi-card__delta` directions render an arrow glyph (▲ ▼ –) plus color.
- `.tooltip` reads its text from a `data-tooltip="..."` attribute and shows on hover
  and keyboard focus (`:focus-visible` / `:focus-within`).
- `.btn.is-loading` hides the label and shows a spinner; pair with `aria-busy` and
  `disabled` in markup.
- Icon-only buttons should carry an `aria-label`; inputs should use `<label for>`.

---

## 5. Responsive Behavior

`.app__main` is a CSS grid that adapts across the required breakpoints:

- **≥ 1440px** — wider gutters; sidebar 300px / right rail 340px.
- **1025–1439px** — full three-column layout: sidebar · center · right rail.
- **≤ 1024px** — right rail drops below the center column and lays its panels out in a
  wrapping row.
- **≤ 768px** — single column; sidebar, center, right rail stack; rails are no longer
  sticky; topbar height shrinks to 56px.
- **≤ 480px (covers 375px)** — KPI bar becomes two columns, modal actions stack
  full-width, headings scale down, padding tightens. Body text stays ≥ 16px and there
  is no horizontal scroll.

---

## 6. Motion & Accessibility

- Transitions are 150–300ms and animate **color / opacity / shadow / paint**, not box
  size, so hover states never reflow neighbors. `:active` uses a 1px `translateY` that
  does not affect surrounding layout.
- Keyframe utilities: `.anim-countup`, `.anim-pulse`; plus internal spinner, toast,
  modal entrance, and needle-glow animations.
- A global reduced-motion guard is included:

  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

- Visible `:focus-visible` rings appear on every interactive element (buttons, tabs,
  cards, pills, region tiles, event choices). Pointer focus is suppressed via
  `:focus-visible`.
- Color is never the sole signal: KPI deltas and log entries use glyphs + color; map
  tiles support text labels and stroke styles; the undecided EC segment uses a striped
  pattern.

---

## 7. Pre-Delivery Checklist

(Reproduced from the `ui-ux-pro-max` skill and verified for this stylesheet.)

### Visual Quality
- [x] No emojis used as icons (CSS-drawn glyphs / `clip-path` star instead)
- [x] Iconography from a consistent approach (CSS glyphs; SVG icons inherit `currentColor`)
- [x] Brand mark is a CSS star badge (no guessed third-party logos)
- [x] Hover states don't cause layout shift (color/opacity/shadow only)
- [x] Theme colors used via tokens consistently

### Interaction
- [x] All clickable elements have `cursor: pointer`
- [x] Hover states provide clear visual feedback
- [x] Transitions are smooth (150–300ms)
- [x] Focus states visible for keyboard navigation (`:focus-visible`)
- [x] Buttons have `[disabled]` and `.is-loading` states; min 44×44px touch target

### Dark Mode / Contrast
- [x] Dark "war room" theme; no pure-white surfaces
- [x] Body and heading text meet WCAG AA (≥ 4.5:1); muted reserved for large/secondary
- [x] Glass/transparent elements remain legible (header, modal backdrop)
- [x] Borders visible against dark surfaces

### Layout
- [x] Sticky header has no content hidden behind it (sticky offsets accounted for)
- [x] Consistent max-width container (1600px) and token-based spacing
- [x] Responsive at 375px, 768px, 1024px, 1440px
- [x] No horizontal scroll on mobile

### Accessibility
- [x] Color is not the only indicator (glyphs, labels, patterns, stroke styles)
- [x] `prefers-reduced-motion` respected
- [x] `.visually-hidden` utility provided for screen-reader-only text
- [x] Guidance noted for `aria-label` on icon buttons and `<label for>` on inputs
