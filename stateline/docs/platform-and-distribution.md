# Platform, distribution & modding

This doc records the decision for how Stateline ships and gets modded, informed by research into
**Subway Builder** — the most successful real-data-grounded simulation game in an adjacent space (real
transit/geographic/census data → deep ridership simulation). The finding strongly validates the stack
we're already building on.

## What Subway Builder is built on (researched, primary-source)

| Aspect | Finding |
|---|---|
| Engine | **No traditional game engine.** TypeScript + React + deck.gl/WebGL, Protomaps/MVT vector tiles, packaged as an **Electron** desktop app (with a browser mode). |
| Distribution | Direct download + **Steam** (Win/macOS/Linux desktop). No mobile. |
| Modding | A real, documented **JavaScript** API (`window.SubwayBuilderAPI`); mods are a `.zip` of `manifest.json` + `index.js`; shared via Discord (no Steam Workshop). |
| Real data | **Baked offline into versioned, gzip-compressed JSON/GeoJSON snapshots + vector tiles**, validated with **Zod schemas**, loaded declaratively per city. Heavy computation precomputed, not done at runtime. |
| Pedigree | The dev's prior project (Redistricter) is a Census/political-demographic web app — the *exact* domain we're in. |

Sources: Subway Builder modding docs (`subwaybuilder.com/docs`), the dev's GitHub (`github.com/colindm`),
Steam page (app 4039140), Wikipedia, PC Gamer. Engine determination is HIGH confidence (the docs include
an explicit Electron page and a `window`-global JS API).

## Why this validates our direction

We independently chose **TypeScript + React + Vite**, **baked versioned data snapshots**, and **Zod
validation** — which is precisely Subway Builder's architecture. The "go web-first" decision is not a
compromise; it's the proven architecture for a real-data, map/UI-heavy simulation. The web/GIS
ecosystem (deck.gl, MapLibre, Protomaps, turf.js, d3) is far richer than anything in Godot/Unity for
this genre, which is the decisive factor.

## Decisions

- **Engine:** stay on the **web stack** (TypeScript + React + Vite). Keep the simulation core strictly
  engine-agnostic so it can be re-bound to another front-end if ever needed.
- **Desktop distribution:** package with **Tauri** (preferred — Rust shell + system webview, far smaller
  and lighter than Electron) or Electron. Target **Steam** (Win/macOS/Linux) + direct download.
- **Maps:** **MapLibre GL + Protomaps/MVT vector tiles**, with boundary geometry baked from Census
  TIGER. Open, offline-bakeable, no Mapbox bill.
- **Modding format:** a **content pack** = a `manifest.json` + schema-validated data (issues, segments,
  campaign actions, bills, the Scribblenauts-style political-concept dictionary) + an optional JS/TS
  entry script. A **region/scenario pack** is the core moddable unit — the same path first-party content
  uses. Publish the **Zod/JSON schemas** so community data is validated. Improve on Subway Builder by
  enabling **Steam Workshop** for frictionless distribution.

## Concrete patterns we're copying

1. Bake real data into **versioned, compressed JSON/GeoJSON** snapshots (per state/district), not live
   API calls. (Already done — see `docs/data-pipeline.md`.)
2. **Precompute the heavy stuff offline** (demographic aggregates, calibration, adjacency).
3. Ship **region/scenario as the unit of modding** with a manifest + published schemas.
4. **Vector tiles via Protomaps/MapLibre** for the map.
5. **Public, versioned modding docs** from early on; let UI mods reuse our component + chart libraries.

## What we are deliberately NOT copying

- Live data feeds for finance/bills (that's a dashboard, not a game).
- Discord-only mod sharing — we'll wire **Steam Workshop**.
