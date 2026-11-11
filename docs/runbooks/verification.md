---
type: runbook
description: Read when running the dev server, the checks, or verifying a web change in Arcade Club.
version: 1.0.0
---

# Verification

Project commands for the [verification standard](../standards/verification.md). The
`verify` skill holds the route → module map for driving a change in the browser; the
[mobile runbook](mobile.md) covers the phone app.

## Project facts

| Command | Does |
| --- | --- |
| `pnpm run dev:watch` | Convex (watching) and Vite together; use while editing `convex/` |
| `pnpm run dev:all` | Convex pushed once, then Vite; functions won't re-sync on edit |
| `pnpm run generate-routes` | `tsr generate`; run after adding or removing files under `src/routes/` |
| `pnpm run check` | Biome lint and format check (`pnpm run lint:fix` writes fixes) |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (`pnpm run test:watch` to watch, `pnpm exec vitest run <path>` for one file) |
| `pnpm verify` | `check`, `typecheck` and `test` in order; stops at the first failure |
| `pnpm run build` | Production build |

`check`, `typecheck` and `test` cover every workspace package, with Jest for
`apps/mobile`. The lefthook pre-commit hook, installed by `pnpm install`, runs
`biome check --staged`.

## Verify

- `pnpm install`, `pnpm run check`, `pnpm run typecheck`, `pnpm test` and
  `pnpm run build` pass, and `node scripts/check-project.mjs --strict` reports no
  warnings.
