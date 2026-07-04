---
name: add-new-game
description: Use when adding a new game to Arcade Club — walks through catalog metadata, Convex schema/module, pure rules logic, tests, routes, and the definition-of-done checklist so the game matches every existing pattern.
---

# Add A New Game To Arcade Club

Every game reuses the shared session platform (`gameSessions` + `sessionParticipants`). A new game touches a fixed set of files. Work through the steps in order; each step names the existing game to copy from.

## Step 0: Pick the shape

| Join mode | Copy from | Notes |
| --- | --- | --- |
| `solo` | Sudoku | No participants beyond host; state saved per session. |
| `challenge` | Backgammon, Chess | Share link/QR; second player claims a seat via `sessions.joinByToken`. |
| `room` | Live Quiz, Hitster, Signal Words | Join code; host screen + player phones. |

Decide: `gameType` id (kebab-case), `joinMode`, `authPolicy` (`guestAllowed` unless the game needs accounts), min/max players, and which state is private per player (private state must be filtered server-side in queries — see `convex/signalWords.ts` role-gated key or `convex/bluffDice.ts` per-player dice for the pattern).

## Step 1: Pure rules module (TDD)

- Create `src/lib/games/<game-id>.ts`. Framework-free, deterministic. Export functions for: initial state, action validation, state transition, phase/turn progression, winner detection.
- Randomness: accept an injected `random: () => number` (default `Math.random`) so tests can seed it.
- Invalid actions: return typed error results or throw typed error strings — Convex code converts these to `ConvexError`. Never mutate on invalid input.
- Write `src/lib/games/__tests__/<game-id>.test.ts` FIRST or alongside. Target 15+ tests: normal play, every terminal state, every invalid action.
- Run: `pnpm exec vitest run src/lib/games/__tests__/<game-id>.test.ts`

## Step 2: Catalog entry

`src/lib/games/catalog.ts`:

1. Add the id to the `GameType` union.
2. Add an entry to `GAME_CATALOG_ITEMS` (title, tagline, description, joinMode, authPolicy, `availability: "playable"`, gradient `accent`, lucide `icon`, `primaryAction`, `route: "/<game-id>/new"`, `stats`).

If the game replaces a `coming-soon` placeholder, update that entry instead of adding one.

## Step 3: Convex schema + module

`convex/schema.ts`:

1. Add the id to `gameTypeValidator` (must stay in sync with `GameType`).
2. Add per-game validators (`v.union(v.literal(...))` string enums, never free strings).
3. Add a `<game>States` table keyed by `sessionId` with `.index("by_session", ["sessionId"])`, plus `createdAt`/`updatedAt` numbers. Add a moves/answers table only if history matters.

`convex/<game>.ts` (camelCase file name):

- `createState` mutation: verify session exists and `gameType` matches, idempotent (return existing state if present), seat the host if seats exist.
- Action mutations: load state, enforce permissions (right participant, right seat, right phase, right turn) with `ConvexError`, call the pure module, patch state. On game end also patch the session: `status: "completed"`, `endedAt`.
- `getBundle` query returning `{ session, participants, state, ... }`. **Strip private fields here** — anything one player must not see (hidden dice, spymaster key, other racks) must not be in the shared bundle; expose it via a separate participant-checked query.
- First real action should set the session `status: "active"` and `startedAt` (see `convex/backgammon.ts` `rollDice`).

Run `pnpm run dev:watch` (or `pnpm exec convex dev --once`) so codegen picks up the new module before typechecking.

## Step 4: Join wiring

- Challenge games: `convex/sessions.ts` `joinByToken` has a per-game block that seats the second player (see the backgammon block). Add one for your game.
- Room games: joining via `joinByCode` needs no per-game code; the game module reads participants.
- `src/routes/join.tsx`: add a `result.gameType === "<id>"` redirect to your play route.

## Step 5: Routes + components

- `src/routes/<game-id>/new.tsx`: creation page. Copy `src/routes/backgammon/new.tsx` (challenge) or `src/routes/sudoku/new.tsx` (solo) or `src/routes/quiz/new.tsx` (room). Pattern: `sessions.create` → `<game>.createState` → store `arcade-club.participantId` in sessionStorage → navigate to the session route.
- `src/routes/<game-id>/$sessionId.tsx`: subscribes to `api.<game>.getBundle`, renders loading/not-found/game states. Room games use a `$sessionId/` directory with `index.tsx` (host) and `play.tsx` (player).
- Interactive components go in `src/components/<game-id>/`. Reuse `src/components/games/` (QrSharePanel, ParticipantList, SessionShell, SeatBanner).
- Error handling in components: `getUserErrorMessage(caught, "fallback")` from `#/lib/games/errors` — never show raw Convex errors.
- Styling: dark club theme, `club-wrap` / `club-panel` / `club-kicker` / `club-title` utility classes, Tailwind. Mobile-first: must work at 360 px, touch targets ≥ 44 px.
- After adding/removing route files: `pnpm run generate-routes`.

## Step 6: Verify (definition of done)

- [ ] `pnpm test` passes (15+ new logic tests).
- [ ] `pnpm run check` passes (Biome).
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run build` passes.
- [ ] Catalog card visible and routes to a playable flow.
- [ ] Game completes to a terminal state; end screen offers rematch or next action.
- [ ] Illegal actions rejected server-side (test at least one).
- [ ] Refresh restores the participant's seat/role (sessionStorage `arcade-club.participantId` + `joinByToken` reclaim).
- [ ] Private per-player state is not readable through shared queries.
- [ ] Guest play works when `authPolicy` allows it.
- [ ] Usable at 360 px wide, no horizontal scroll.
- [ ] Seed content (puzzles/word packs) validated by schema checks, family-friendly, no copied trade dress or branded names.

## Gotchas

- `GameType` (catalog) and `gameTypeValidator` (convex/schema.ts) must list identical ids or session creation fails validation.
- Convex functions must not import framework code; pure modules must not import Convex.
- `settings` on `gameSessions` only accepts string/number/boolean values.
- Don't hand-roll rules for classic games with proven libraries (chess → `chess.js`).
- Port 3000 is OS-reserved on this machine; Vite dev runs elsewhere — check `.claude/launch.json`.
