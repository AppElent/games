---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck.
---

# Verify (games)

Local-first: use the Claude Preview browser tools (`preview_start` against `.claude/launch.json`'s `All (dev:watch)` config, port 3000) to drive the actual flow the change affects. On web/without a live preview, fall back to `pnpm verify && pnpm build`.

## Auth note

The sign-in screen shows a "▶ Dev: log in as test user" button (`src/lib/auth`'s `TestLoginButton`) whenever `VITE_CLERK_PUBLISHABLE_KEY` is a `pk_test_...` key **and** `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set in `.env.local`. Use it to get past the login wall when verifying auth-gated flows — don't assume those pages are unreachable for automated verification. If the button isn't showing, check `.env.local` for those two vars before concluding the app can't be tested logged-in.

## Games

Every game is a `gameSessions` row plus a per-game state table ([game sessions contract](../../../docs/contracts/game-sessions.md)). Drive a game change through the route and the Convex session flow (join by room code, challenge link, or solo), and check layout changes in fullscreen and in the pause menu. Routes live in `src/routes/<game>/`. Not obvious from the code:

- `/bluff-dice` serves legacy sessions only; new games and migrated sessions go to `/dice`.
- `/word-links` and `/squad-surge` are local-only, with no Convex session.
- `/join` dispatches through `ON_JOIN` in `convex/lib/join.ts`.

## Mobile app

A change under `apps/mobile/` or one it bundles (`packages/core`, a Convex function the app calls) is verified on a simulator or emulator: build, run and drive the app as [the mobile runbook](../../../docs/runbooks/mobile.md) describes, including its deep-link entry points and hosting from the CLI. Off-device, fall back to `pnpm --filter @arcadeclub/mobile typecheck` and `pnpm --filter @arcadeclub/mobile test`.
