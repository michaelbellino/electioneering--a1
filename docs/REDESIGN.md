# Campaign Trail — Redesign GDD & Design System

> Working design doc for the "full tycoon sim" redesign. Authored at the start of
> Phase 1 (studio process: design before code). Supersedes the old "dark war room"
> aesthetic in `design-system/campaign-trail/MASTER.md`.

## 1. Creative brief (theme & tone)

**Campaign Trail is a satire of the electioneering system.** The premise:

> The system *pretends to be human* — warm, civic, "for the people." Underneath it
> is a **cold, calculated network**: voters reduced to *nodes* and *segments*,
> beliefs to data, money to *edges*. Democracy is run like an ad-tech product. The
> brighter and slicker the brand surface, the more the machine shows through.

The satire targets **commercialism / marketing culture**: the game is framed as a
SaaS product — *"DEMOS Strategic Solutions — Democracy, Optimized.™"* — with cheery
brand microcopy over clinical optimization metrics. As the player takes dirty money
and optimizes harder, the bright UI literally **corrupts** (money-green stains, a
rising "machine influence" meter, a tarnishing brand mark).

Tone: **satirically dark, but bright on the surface.** Not gritty-noir; not cute. The
joke is the polish.

## 2. Design system

### Themes
- **Bright is the default**; **dark is an opt-in** toggle (persisted to
  `localStorage`, key `campaign-trail:theme:v1`). Implemented purely through CSS
  custom-property overrides under `html.dark` — every component is token-driven, so
  the structure and tests are theme-agnostic.

### Palette (semantic tokens, `assets/css/styles.css`)
| Token | Meaning | Bright | Dark |
|---|---|---|---|
| `--bg-midnight` | app paper | `#EEF0F4` | `#0A0C12` |
| `--bg-panel` | cards | `#FFFFFF` | `#141823` |
| `--color-accent` | **warm** "human" brand / CTA | `#F2542D` | `#FF6A45` |
| `--color-cold` | **the machine** — network / data | `#0E83C8` | `#2FB6EC` |
| `--color-money` | **corruption** / dirty money | `#2FA866` | `#37C77C` |
| `--color-primary` / `--color-opponent` | party blue / red (map only) | `#1F5FBF` / `#C8243A` | brighter |

Coral = the friendly mask; cold blue = the network truth; money-green = the rot.
Party red/blue are **reserved for the cartogram**, never for chrome.

### Typography (self-hosted, SIL OFL — `assets/fonts/`)
- **Display — Bricolage Grotesque** (`--font-display`): the warm, humanist "brand"
  face. Headlines, the wordmark, candidate names.
- **Body — Public Sans** (`--font-body`): the literal US Web Design System face —
  civic, official, readable. The ironic "for the people" voice.
- **Data — Space Mono** (`--font-mono`): the cold machine. Every metric, label,
  segment id, ROI readout.

The face-pairing *is* the duality: warm display + civic body + clinical mono.

### Iconography
Custom inline SVG glyphs (`src/ui.js` `ICON_PATHS`) — network node, rosette/target,
megaphone, dark-money, ad-buy, ground-game, ethics-lock, returns — plus Phosphor
(MIT) for utility icons as needed. No emoji.

### Motifs
Voters-as-network (node/edge graphs), monospace "system" labels (`// segment_07`),
hairline rules, a brand mark that is a smiling rosette which is actually a network
node / crosshair, and corruption stains that spread with the machine-influence meter.

## 3. Mechanics — the tycoon sim (target)

Replace one-click actions with a **customizable, deep simulation**.

- **Time/action economy.** Each week you allocate a budget of **hours** across
  activities (not a fixed AP count). Sleep/health caps create real tradeoffs.
- **Parameterized actions** (sliders, not buttons):
  - **Fundraise** — hours × intensity × *source* (grassroots / PAC / **dark money**)
    → \$ raised vs. **scandal exposure**, **burnout**, and **favors owed**.
  - **Rally** — length × region → momentum vs. cost & gaffe risk.
  - **Ads** — budget × targeting (by segment) → reach vs. backlash.
- **Money & influence network.** Donor segments, PACs, dark money, favors owed, a
  **machine-influence** meter, scandal **exposure** that can break into indictment.
  Voters modeled as a segmented network.
- **Operations (tycoon).** Hire/manage **staff**, open **field offices**, ground
  game / GOTV.
- **Media & opposition.** A news/media cycle, an **ad market**, polling firms,
  scheduled **debates**, opposition research, **ethics/indictment** risk.

The deterministic, testable engine architecture (pure `src/engine.js`, seeded RNG,
JSON-serializable state, one mutation channel) is **preserved and extended** — every
new system ships with `node --test` coverage and `test/sim.js` balance sweeps.

## 4. Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| **1 · Identity & shell** | Bright+dark theme, OFL fonts, glyphs, satirical chrome, dark-mode toggle | ✅ this commit |
| **2 · Time economy + parameterized actions** | Hour budget; Fundraise/Rally/Ads as sliders + exposure/corruption layer | ⏳ |
| **3 · Money & influence network** | Donors, PACs, dark money, favors, machine-influence meter, voter-network | ⏳ |
| **4 · Operations** | Staff, field offices, ground game / GOTV | ⏳ |
| **5 · Media & opposition** | News cycle, ad market, polling firms, debates, oppo, ethics/indictment | ⏳ |
| **6 · Polish · a11y · balance** | QA backlog (below), balance sims, soak test, release | ⏳ |

Each phase ships a **playable, tested** build and is committed/pushed.

## 5. Carried-over QA requirements (from the verified review)

These confirmed findings live in components the redesign rebuilds; they are **hard
requirements** for the relevant phase rather than patches on doomed markup:

- **Focus preservation (HIGH):** re-render must not drop keyboard focus to `<body>`.
  The new UI diffs in place / restores focus to the logical control after updates.
- **Modal `inert`:** when a dialog is open, the background must be `inert` /
  `aria-hidden`, not just visually behind it.
- **Map a11y:** region tiles are real toggle buttons (`aria-pressed`), announce
  selection, and encode lean with a **non-colour** cue (text/glyph) for colourblind
  users — not fill colour alone.
- **One canonical EV total:** the topbar and the EV bar must read the same projection.
- **Opponent solvency:** cap per-week AI spend so it doesn't oscillate broke→fundraise.
- **Skip-link target & toast-over-overlay:** every screen exposes `#main-content`;
  toasts clear when a full-screen result overlay shows.

Already fixed on the current engine (durable): save/load field validation+repair, and
the start/end-screen flex-centering collapse.
