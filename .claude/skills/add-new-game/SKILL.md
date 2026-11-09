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

1. Add the id to `GAME_TYPES` in `packages/core/src/games.ts`; Convex's `gameTypeValidator` derives from it. A game with online sessions also gets its `joinMode` and `authPolicy` in `GAME_SESSION_POLICY` in the same file (it fails to compile until you do); a local-only game is excluded from `SessionGameType` there instead.
2. Add the `GAME_CATALOG` entry in `src/lib/games/catalog.ts` (it fails to compile until you do): gradient `accent`, lucide `icon`, `route: "/<game-id>/new"`, `sessionPath` (where a seated player plays; `null` for a local-only game), and `hostPath` only when the host runs the game on a screen of its own (Hitster, Live Quiz; see Step 4). `/join` navigates through `sessionPath`, so it needs no per-game code.
3. Add display text to `packages/core/src/i18n/{en,nl}/catalog.ts`, and screen text to `packages/core/src/i18n/{en,nl}/games/<game>.ts`, registered in `packages/core/src/i18n/{en,nl}/index.ts`. The message parity test fails until `nl` has every `en` key.

## Step 3: Convex

`convex/schema.ts`: add a `<game>States` table with `sessionId`, `createdAt`, `updatedAt` and `.index("by_session", ["sessionId"])`. Enums use `literals(<CORE_ARRAY>)` from `convex/lib/validators.ts`, never free strings. Add a moves table only if history matters. Register the table in `STATE_TABLES` in `convex/lib/gameSession.ts` (it fails to compile until you do).

`convex/<game>.ts` (camelCase file name; it becomes the public `api.<game>` path):

- `create` mutation: `args: hostedSessionArgs` (plus the game's options), `returns: createdSessionValidator`. Call `hostGame(ctx, "<game-id>", args)` (`convex/lib/hostedSession.ts`), which opens the session and seats the host under the game's `GAME_SESSION_POLICY`; insert the state row in the same mutation, so a session never exists without its state; return `createdSession(hosted)`. Copy `create` in `convex/connectFour.ts`.
- Action mutations take `seatArgs`, start with `loadGame(ctx, "<game-id>", sessionId)`, prove the seat is the caller's with `requireOwnParticipant(ctx, args)` (host-only ones then `requireHostByParticipantId`), check the actor, call core through `rules(() => ...)` (turns `GameRuleError` into a keyed `ConvexError`), and patch state. Throw `gameError(code)` from `convex/lib/errors.ts` for other refusals; never English text. The first real move calls `startSession`; the end calls `finishSession` with the winners; a rematch calls `reopenSession` (all `convex/lib/gameSession.ts`).
- `getBundle` query returns `loadBundle(ctx, "<game-id>", sessionId)` (`{ session, participants, state }`, or null). Strip private fields from it here and serve them through a separate participant-checked query.

Two-seat games: the state row stores `phase`, `activeColor` and one `<seat>ParticipantId` column per seat, named after core's seat array (`CONNECT_FOUR_COLORS`), plus `winnerParticipantId`. Add a `Duel` descriptor to `convex/lib/duel.ts` (seats and error codes, see `CONNECT_FOUR_DUEL`) and list it in `DUELS`; `DuelGame` and the share-link join hook in `convex/lib/join.ts` derive from that list, so `convex/sessions.ts` and `ON_JOIN` need no edit. In the game file: `seatHost` while inserting the state, `requireTurn` before a move, `opponent(<COLORS>, seat)` from `@arcadeclub/core/duel` for the next turn, `requireResign`, `finishDuel` at the end and `rematchDuel` for the next game. Room games read participants and need no join hook.

Run `pnpm exec convex dev --once` (or keep `pnpm run dev:watch` running) so codegen picks up the module before typechecking.

## Step 4: Web routes and components

- `src/routes/<game-id>/new.tsx`: a game with no options renders `NewGamePage` (`src/components/games/NewGamePage.tsx`) with `create={useMutation(api.<game>.create)}`; copy `src/routes/connect-four/new.tsx`. A game with options gets its own page component that calls `useHostSession` (`src/lib/games/use-host-session.ts`), as `SudokuNewPage` (`src/components/sudoku/SudokuNewPage.tsx`) does; the route only renders it. Either way the tab remembers its seat and lands on `sessionPath`.
- `src/routes/<game-id>/$sessionId.tsx`: subscribe to `api.<game>.getBundle` and render through `SessionBundleRoute` (loading, not found, game); copy `src/routes/connect-four/$sessionId.tsx`. Room games take one of two shapes:
  - One room screen for everyone (Bluff Dice, Signal Words): a single `$sessionId.tsx` whose screen shows host controls to the host's seat. The catalog entry has no `hostPath`. Copy `src/routes/bluff-dice/$sessionId.tsx`.
  - A host screen apart from the players' phones (Hitster, Live Quiz): a `$sessionId/` directory with `host.tsx` and `play.tsx`, and a catalog `hostPath` pointing at `host`. Copy `src/routes/hitster/$sessionId/`.
- `src/routes/<game-id>/index.tsx` redirects to `/<game-id>/new`. Every game route sets `staticData: { fullscreen: true }`.
- Screens go in `src/components/<game-id>/`, built from `src/components/games/` the way the closest existing game's screen is. Type the bundle as `NonNullable<FunctionReturnType<typeof api.<game>.getBundle>>`.
- The player's seat: `useSeat(sessionId)` from `src/lib/games/seat.ts`. A mutation sent as that seat goes through `seatAction(send, fallback)` from `useSeatAction(sessionId)` (`src/lib/games/use-seat-action.ts`): it passes `{ sessionId, participantId, guestId }` (the `seat` it also returns, for a query) to `send`, and is undefined while the tab holds no seat, so the screen can hide or disable the action. `BluffDiceRoom` and `SignalWordsRoom` use it. Any other mutation runs through `run(() => mutate(...), fallback)` from `useGameAction` (`src/lib/games/use-game-action.ts`). Both show a localized error and resolve to whether the call succeeded. Two-seat screens get the seat, turn and `seatAction` from `useDuel` (`src/components/games/match/useDuel.ts`), as `ConnectFourMatch` does. A client offers a move only when core `duelTurn(seats, state, participantId)` allows it, the rule `requireTurn` enforces.
- Styling: dark club theme (`club-wrap`, `club-panel`, `club-kicker`, `club-title`) with Tailwind; works at 360 px with 44 px touch targets.
- After adding route files: `pnpm run generate-routes`.

## Step 4b (optional): Mobile app

The mobile app (`apps/mobile`) carries only Sudoku, Backgammon, Hitster and the card games (Pesten and Jokeren). Adding a game there is its own task; read `apps/mobile/CODING_STANDARDS.md` first. A new card game for an existing rule family needs no mobile code: the card hub and tables read the core config.

1. Add the game to `APP_GAMES` in `apps/mobile/src/features/play/app-games.ts`: hub `href`, icon and tint, and for an online game `online` with its `create` mutation (`api.<game>.create`, exposed through `apps/mobile/src/convex/api.ts`) and the `sessionHref` a seated player opens; `seatSecret: true` when seats are proven by a secret the phone keeps (card tables), and `titledBySession: true` when one entry opens several games so Continue shows the session's title. The Play tab, Continue, `/join` (through `isOnlineAppGame`) and the hosting hook (`useHostSession("<game-id>")`) all read it.
2. Routes in `apps/mobile/app/<game-id>/` render one screen each from `apps/mobile/src/features/<game-id>/<subject>/`; the hub screen sets its own title. Online screens wrap their loading and missing states in `OnlineScreenFrame` (`src/features/sessions/components/`) and read the seat through `useSeatedSession`. A two-seat screen decides whether to offer a move with core `duelTurn`, as `src/features/backgammon/online/use-online-match.ts` does.
3. Continue: online seats are listed by `src/features/sessions/session-seats.ts` with no per-game code. A local save gets a store that validates parsed data and degrades to "no save", and a `resumableItems()` that you add to `listContinueItems` in `src/features/play/home/continue-items.ts`.
4. Add the Play-tab tagline under `taglines` in `packages/core/src/i18n/{en,nl}/play.ts`, and Jest tests next to the logic.

## Grid puzzle variants

A new kind of grid puzzle played on the Sudoku screens (as killer and binary are) is not a new game. Add its id to `SUDOKU_VARIANTS` in `packages/core/src/sudoku.ts` and its entry to `SUDOKU_VARIANT_RULES` in `packages/core/src/sudoku-variants.ts`: `cells`, `maxDigit`, `conflicts`, `solved`, `validate` (refusals the grid checks do not cover), `stored` (the fields it keeps beside the grids) and `generate`. A field it stores needs an optional column on `sudokuStates` in `convex/schema.ts` and a place in `VariantShape`. Convex and the web session go through these rules, so neither names the variant.

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
