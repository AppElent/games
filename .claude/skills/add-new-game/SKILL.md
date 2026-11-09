---
name: add-new-game
description: Use when adding a new game to Arcade Club — walks through shared rules, game identity and catalog, the Convex module, web routes, tests and the definition of done so the game matches every existing pattern.
---

# Add A New Game To Arcade Club

Every online game reuses the shared session platform (`gameSessions` + `sessionParticipants`, see "Game session model" in `AGENTS.md`). Work through the steps in order; each names the existing game to copy. Connect Four is the smallest complete example of every step.

## Card games: config first

A card game that fits a rule family in `packages/core/src/cards/` (`shedding`, `rummy`) needs none of the steps below:

1. Add a definition to `packages/core/src/cards/games/`, copying `pesten.ts` or `jokeren.ts`.
2. List it in `CARD_GAMES` in `packages/core/src/cards/engine.ts`.
3. Add its text under `games.cards.games` in `packages/core/src/i18n/{en,nl}/games/cards.ts`.
4. Add rule tests to `packages/core/src/__tests__/cards.test.ts`.

A card game outside those families needs a new family module and a table component in `src/components/cards/`, but no new Convex tables or functions. See [the decision](../../../docs/adr/0001-card-games-use-rule-families-and-config.md).

## Step 0: Pick the shape

| Join mode | Copy from | Notes |
| --- | --- | --- |
| `solo` | Sudoku | Host only; state saved per session. The only mode a guest can host. |
| `challenge` | Connect Four (then Chess, Backgammon) | Two seats. The second player claims one through the share link (`sessions.joinByToken`). |
| `room` | Bluff Dice, Signal Words (then Hitster, Live Quiz) | Join code; host screen plus player phones. |

Decide the `gameType` id (kebab-case), `joinMode`, `authPolicy` (`guestAllowed` unless the game needs accounts), and which state is private per player. Private state is filtered server-side: see the role-gated key in `convex/signalWords.ts` or the per-player dice in `convex/bluffDice.ts`.

## Step 1: Rules in `packages/core` (TDD)

- Create `packages/core/src/<game-id>.ts`: pure, deterministic, no dependencies, imported by subpath (`@arcadeclub/core/<game-id>`). Rules that need a library get their own package, as `packages/chess` wraps `chess.js`.
- Export initial state, move validation, transitions, turn/phase progression and winner detection. Export each stored enum as an `as const` array; Convex derives its validator from it.
- Randomness: take an `Rng` (`packages/core/src/random.ts`), so tests seed it with `mulberry32`.
- Illegal moves throw `GameRuleError(code, params)` from `@arcadeclub/core/errors` and never mutate input. Each `code` is a key of `serverErrors`: add new ones to `packages/core/src/i18n/{en,nl}/serverErrors.ts`.
- Write `packages/core/src/__tests__/<game-id>.test.ts` first or alongside: normal play, every terminal state, every illegal move.

## Step 2: Game identity, catalog and text

1. Add the id to `GAME_TYPES` in `packages/core/src/games.ts`. Convex's `gameTypeValidator` derives from it.
2. Add the `GAME_CATALOG` entry in `src/lib/games/catalog.ts` (it fails to compile until you do): `joinMode`, `authPolicy`, gradient `accent`, lucide `icon`, `route: "/<game-id>/new"`, `sessionPath` (where a seated player plays; `null` for a local-only game), and `hostPath` when the host's screen differs (room games). `/join` navigates through `sessionPath`, so it needs no per-game code.
3. Add display text to `packages/core/src/i18n/{en,nl}/catalog.ts`, and screen text to `packages/core/src/i18n/{en,nl}/games/<game>.ts`, registered in both `index.ts` files. The message parity test fails until `nl` has every `en` key.

## Step 3: Convex

`convex/schema.ts`: add a `<game>States` table with `sessionId`, `createdAt`, `updatedAt` and `.index("by_session", ["sessionId"])`. Enums use `literals(<CORE_ARRAY>)` from `convex/lib/validators.ts`, never free strings. Add a moves table only if history matters. Register the table in `STATE_TABLES` in `convex/lib/gameSession.ts`.

`convex/<game>.ts` (camelCase file name; it becomes the public `api.<game>` path):

- `create` mutation: `args: hostedSessionArgs`, `returns: createdSessionValidator`. Call `createHostedSession` (`convex/lib/hostedSession.ts`) with the game's `gameType`, `joinMode` and `authPolicy`, then insert the state row (and seat the host) in the same mutation, so a session never exists without its state.
- Action mutations start with `loadGame(ctx, "<game-id>", sessionId)`, check the actor, call core through `rules(() => ...)` (turns `GameRuleError` into a keyed `ConvexError`), and patch state. Throw `gameError(code)` from `convex/lib/errors.ts` for other refusals; never English text. The first real move calls `startSession`; the end calls `finishSession` with the winners; a rematch calls `reopenSession` (all `convex/lib/gameSession.ts`).
- `getBundle` query returns `{ session, participants, state }` through `listParticipants` and `findGameState`. Strip private fields here and serve them through a separate participant-checked query.

Two-seat games: add the id to `DuelGame` and a `Duel` descriptor to `convex/lib/duel.ts` (seat names and error codes, see `CONNECT_FOUR_DUEL`) and use its `requireTurn`, `requireSeat`, `requireRematch`, `swapSeats` and `winnerOf`. Add `"<game-id>": seatChallengerByShareToken(<GAME>_DUEL)` to `ON_JOIN` in `convex/lib/join.ts`; `convex/sessions.ts` names no game. Room games read participants and need no join hook.

Run `pnpm exec convex dev --once` (or keep `pnpm run dev:watch` running) so codegen picks up the module before typechecking.

## Step 4: Web routes and components

- `src/routes/<game-id>/new.tsx`: a game with no options renders `NewGamePage` (`src/components/games/NewGamePage.tsx`) with `create={useMutation(api.<game>.create)}`; copy `src/routes/connect-four/new.tsx`. A game with options calls `useHostSession` (`src/lib/games/use-host-session.ts`) itself, as `src/routes/sudoku/new.tsx` does. Either way the tab remembers its seat and lands on `sessionPath`.
- `src/routes/<game-id>/$sessionId.tsx`: subscribe to `api.<game>.getBundle` and render through `SessionBundleRoute` (loading, not found, game); copy `src/routes/connect-four/$sessionId.tsx`. Room games use a `$sessionId/` directory with a host and a player route.
- `src/routes/<game-id>/index.tsx` redirects to `/<game-id>/new`. Every game route sets `staticData: { fullscreen: true }`.
- Screens go in `src/components/<game-id>/`, built from `src/components/games/` the way the closest existing game's screen is. Type the bundle as `NonNullable<FunctionReturnType<typeof api.<game>.getBundle>>`.
- The player's seat: `useSeat(sessionId)` from `src/lib/games/seat.ts`. Every mutation runs through `run(() => mutate(...), fallback)` from `useGameAction` (`src/lib/games/use-game-action.ts`), which shows a localized error and resolves to whether it succeeded.
- Styling: dark club theme (`club-wrap`, `club-panel`, `club-kicker`, `club-title`) with Tailwind; works at 360 px with 44 px touch targets.
- After adding route files: `pnpm run generate-routes`.

## Step 4b (optional): Mobile app

The mobile app (`apps/mobile`) carries only Sudoku, Backgammon and Hitster. Adding a game there is its own task; read `apps/mobile/CODING_STANDARDS.md` first.

1. Add the game to `APP_GAMES` in `apps/mobile/src/features/play/app-games.ts`: hub `href`, icon and tint, and for an online game `online` with its `create` mutation (`api.<game>.create`) and the screen a seated player opens. The Play tab, Continue, `/join` and the hosting hook (`useHostSession("<game-id>")`) all read it.
2. Routes in `apps/mobile/app/<game-id>/` render one screen each from `apps/mobile/src/features/<game-id>/<subject>/`; the hub screen sets its own title. Online screens wrap their loading and missing states in `OnlineScreenFrame` (`src/features/sessions/components/`) and read the seat through `useSeatedSession`.
3. A local save gets a store that validates parsed data and degrades to "no save", and a `resumableItems()` listed in `src/features/play/home/continue-items.ts`.
4. Add the Play-tab tagline under `taglines` in `packages/core/src/i18n/{en,nl}/play.ts`, and Jest tests next to the logic.

## Step 5: Tests

- Core rules: Step 1.
- Convex: `convex/<game>.test.ts` with convex-test, copying `convex/connectFour.test.ts` and the helpers in `convex/test.helpers.ts` (`setup`, `signedInHost`, `HOSTED`, `joinWithToken`, `joinWithCode`). Cover create, join, a move, finish and rematch. Assert every refusal with `expectCode(promise, "<code>")`, which fails on a crash or a different code.
- Web logic outside components: `src/lib/games/__tests__/`.

## Step 6: Definition of done

- [ ] `pnpm test`, `pnpm run check`, `pnpm run typecheck` and `pnpm run build` pass.
- [ ] The catalog card opens a playable flow, and `/join` lands a second player on the right screen.
- [ ] The game reaches every terminal state; the end screen offers a rematch or next action.
- [ ] Illegal actions are refused server-side, each with its own `serverErrors` code in both languages.
- [ ] A refresh keeps the player's seat.
- [ ] Private per-player state is not readable through shared queries.
- [ ] Guest play works when `authPolicy` allows it.
- [ ] Usable at 360 px wide, no horizontal scroll.
- [ ] Seed content (puzzles, word packs) follows the `generate-game-content` skill.

## Gotchas

- Convex functions import no framework code; `packages/core` imports nothing outside itself.
- `settings` on `gameSessions` accepts only string, number and boolean values.
- Use a proven library for classic games (chess uses `chess.js` through `packages/chess`).
