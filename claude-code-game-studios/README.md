# MBellino Test Space

This repository has the **[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)**
system (by [Donchitos](https://github.com/Donchitos)) incorporated into it —
turning a single Claude Code session into a full game development studio.

## What's incorporated

| Category | Count | Location |
|----------|-------|----------|
| **Agents** | 49 | `.claude/agents/` |
| **Skills** (slash commands) | 73 | `.claude/skills/` |
| **Hooks** | 12 | `.claude/hooks/` |
| **Rules** (path-scoped standards) | 11 | `.claude/rules/` |
| **Templates / docs** | many | `.claude/docs/`, `docs/` |
| **Master config** | — | `CLAUDE.md` |
| **Settings** (hooks, permissions, statusline) | — | `.claude/settings.json` |
| **Skill testing framework** | — | `CCGS Skill Testing Framework/` |

The `.github/` directory and the original project `README.md` from upstream were
intentionally **not** copied, so this repo keeps its own identity.

## Getting started

Open this folder in Claude Code and run:

- `/start` — guided onboarding (asks where you are, then routes you to the right workflow)
- `/help` — browse the full 7-phase workflow catalog
- `/setup-engine godot 4.6` — configure your engine if you already know it
- `/project-stage-detect` — analyze an existing project

The studio is organized into three tiers — directors (vision), department leads
(domain owners), and specialists (hands-on work) — across design, programming,
art, audio, narrative, QA, and production. Engine specialists are included for
**Godot 4**, **Unity**, and **Unreal Engine 5**.

> The hooks in `.claude/settings.json` run automatic validation on commits,
> pushes, asset changes, and session lifecycle events. They fail gracefully if
> optional tools (`jq`, Python 3) are missing.

## Attribution & license

The incorporated Claude Code Game Studios components are released under the
**MIT License**, Copyright (c) 2026 Donchitos. The full license text is preserved
in [`LICENSE`](LICENSE). See [`UPGRADING.md`](UPGRADING.md) and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the upstream project's migration and
contribution guidance.

Upstream: https://github.com/Donchitos/Claude-Code-Game-Studios
