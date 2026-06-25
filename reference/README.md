# reference/

Material kept for reference. **Nothing here is part of the Campaign Trail build**
(the game lives at the repository root).

## `stateline/`

**Stateline** — an independent take on an election-campaign simulation game, built
as a TypeScript · React · Vite app with a pure deterministic engine and a 91-test
suite. It does not share a codebase with Campaign Trail (which is no-build vanilla
JS), so it is preserved here as reference rather than fused into the game.

To run it as its own project, copy `stateline/` out to its own directory and:

```bash
npm install && npm run dev      # Vite dev server
npm test                        # Vitest suite
```

Its dependencies (`node_modules/`) and build output are intentionally omitted; run
`npm install` to restore them.
