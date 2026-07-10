---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck.
---

# Verify (games)

Local-first: use the Claude Preview browser tools (`preview_start` against `.claude/launch.json`'s `All (dev:watch)` config, port 3000) to drive the actual flow the change affects. On web/without a live preview, fall back to the static suite: `pnpm run typecheck`, `pnpm run check`, `pnpm test`, `pnpm build`.

## Auth note

The sign-in screen shows a "▶ Dev: log in as test user" button (from `@appelent/auth`'s `TestLoginButton`) whenever `VITE_CLERK_PUBLISHABLE_KEY` is a `pk_test_...` key **and** `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set in `.env.local`. Use it to get past the login wall when verifying auth-gated flows — don't assume those pages are unreachable for automated verification. If the button isn't showing, check `.env.local` for those two vars before concluding the app can't be tested logged-in.

## Route → module map

Session model: every game is a `gameSessions` row (`gameType` discriminator) + a per-game state table, per `CLAUDE.md`'s "Game session model" section. When verifying a change to a specific game, drive it through both the route and the Convex session flow (join by room code / challenge link / solo), not just the UI in isolation.

| Route | Module |
| --- | --- |
| `/` | `src/routes/index.tsx` |
| `/games/$gameType` | `src/routes/games/$gameType.tsx`, `src/lib/games/catalog.ts` |
| `/dashboard` | `src/routes/dashboard/*` |
| `/join` | `src/routes/join.tsx`, `convex/sessions.ts` (`joinByCode`/`joinByToken`) |
| `/quiz/*` | `src/routes/quiz/*`, `convex/quiz.ts` (`liveQuizStates`/`liveQuizAnswers`) |
| `/backgammon/*` | `src/routes/backgammon/*`, `convex/backgammon.ts` (`backgammonGameStates`/`backgammonMoves`) |
| `/chess/*` | `src/routes/chess/*` |
| `/sudoku/*` | `src/routes/sudoku/*` |
| `/hitster/*` | `src/routes/hitster/*` |
| `/connect-four/*` | `src/routes/connect-four/*` |
| `/signal-words/*` | `src/routes/signal-words/*` |
| `/bluff-dice/*` | `src/routes/bluff-dice/*` |
| `/word-links/*` | `src/routes/word-links/*` (local-only, no Convex session) |
| `/squad-surge/*` | `src/routes/squad-surge/*` (local-only, no Convex session) |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/account` | thin `@appelent/auth` wrappers, see `CLAUDE.md` Auth wiring |

All game routes set `staticData: { fullscreen: true }` and render inside `FullscreenGameShell`/`FullscreenGamePage`/`FitScale` (`src/components/games/`) — if a change affects layout, check it in both fullscreen and the pause-menu state.
