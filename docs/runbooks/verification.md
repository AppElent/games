---
type: runbook
description: Read when running the dev server, the checks, or verifying a web change in Arcade Club.
version: 1.1.0
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
| `pnpm verify` | The one-command local check: `check`, `typecheck` and `test` in order; stops at the first failure |
| `pnpm run check` | Just the Biome lint and format check, plus the mobile structure check (`pnpm run lint:fix` writes fixes) |
| `pnpm run typecheck` | Just `tsc --noEmit` for the web app and every workspace package |
| `pnpm test` | Just Vitest, then Jest for `apps/mobile` (`pnpm run test:watch` to watch, `pnpm exec vitest run <path>` for one file) |
| `pnpm run build` | Production build |

Run `pnpm verify` before pushing. Use `check`, `typecheck` or `test` alone to iterate
on one step. `verify` runs all three and covers every workspace package. The lefthook
pre-commit hook, installed by `pnpm install`, runs `biome check --staged`.

## Verify

- `pnpm install`, `pnpm verify` and `pnpm run build` pass, and
  `node scripts/check-project.mjs --strict` reports no warnings.
