# MBellino Test Space

This repository combines the different branches that all relate to **the election
game**, plus the supporting game-development tooling, each preserved intact in its
own subdirectory.

## Contents

| Subdirectory | What it is | Stack | Source branch |
|---|---|---|---|
| [`stateline/`](stateline/) | **Stateline** — a deep, data-grounded US political & electoral simulation game (create a candidate, run a real campaign, play out election night) built on real Census demographics. | TypeScript · React · Vite (pure deterministic engine + React render layer, 91 tests) | `claude/lucid-wright-34ic6a` |
| [`campaign-trail/`](campaign-trail/) | **Campaign Trail** — a turn-based election-campaign strategy game styled as a dark "campaign war room" dashboard, with SVG charts and a cartogram electoral map. | Vanilla JS · hand-written CSS (no build step) | `claude/sweet-dirac-k3gw7m` |
| [`claude-code-game-studios/`](claude-code-game-studios/) | **Claude Code Game Studios (CCGS)** — a game-development studio system (49 agents, 73 skills, hooks, rules, templates) that turns a Claude Code session into a full game studio. Included as supporting dev tooling. | Claude Code agents / skills / hooks | `claude/eloquent-ramanujan-ewgp39` |

Each subdirectory keeps its own `README.md`, build config, and `.gitignore`, and the
history of its source branch is preserved as a merged ancestor of this branch.

## The two election games

`stateline/` and `campaign-trail/` are two independent takes on an election-campaign
simulation game. They do not share a codebase — Stateline is a TypeScript/Vite app
with its own build and test suite, while Campaign Trail is a no-build vanilla-JS
project — so they are kept side by side rather than fused into one codebase. See each
game's own `README.md` for how to run it.

## A note on the CCGS tooling

The Claude Code Game Studios system normally lives at a repository root (its
`.claude/` agents, skills, and hooks are auto-loaded by Claude Code from the root).
Here it is nested under `claude-code-game-studios/` so its `.claude/settings.json`
hooks do not override this repository's own session configuration. The files are
preserved exactly; to activate the studio tooling, use that directory as a project
root (or copy its `.claude/` contents to wherever you want it active).
