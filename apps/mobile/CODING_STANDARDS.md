# Arcade Club mobile coding standards

Apply the shared [mobile coding](../../docs/standards/mobile-coding.md) and
[mobile structure](../../docs/standards/mobile-structure.md) standards. Run and
verify the app with the [mobile runbook](../../docs/runbooks/mobile.md).

## Bindings

- `app/` holds routes only; each route renders one screen from
  `src/features/<game-or-area>/<subject>/`. `src/ui/` holds generic primitives
  and never imports a feature.
- `@arcadeclub/core` owns game rules (Sudoku, Backgammon, Hitster packs and modes,
  card games with their art and table logic in `cards/art.ts` and `cards/table-view.ts`).
  Mobile adds only UI state and storage around them, for example
  `src/features/backgammon/local/use-local-match.ts` over the reducer in
  `@arcadeclub/core/backgammon-local` (callers pre-roll dice so it stays
  deterministic).
- Online games call the same Convex functions as web through
  `src/convex/api.ts`, and host through each game's `create`
  (`backgammon.create`, `hitster.create`, `cardGames.createTable`, `diceGames.createTable`), named with
  the game's screens in `src/features/play/app-games.ts`. A device's seat in an
  online session is stored by `src/features/sessions/session-seats.ts`. Every
  game screen resolves its `participantId` from there, never from route params.
  A card or dice table also needs the seat's `seatSecret`: the phone makes one
  (`seat-secret.ts`), sends it with `createTable` or `joinByCode`, and keeps it
  in the same store, because a participant id alone is public.
- Local saves (Sudoku puzzles, the one pass-and-play backgammon match) use
  `expo-sqlite/kv-store`. Every store validates parsed data and degrades to "no save"
  instead of throwing.
- `src/feedback/haptics.ts` names haptics by meaning (`moveMade`, `gameWon`, `answerRevealed`).
  Screens do not call `expo-haptics` directly.

## Project decisions

| Rule | Scope | Replacement | Reason |
| --- | --- | --- | --- |
| Convex query caching | Mobile reads | `retention` flavour in `src/convex/query-cache.tsx`: 5 min expiration, 20 idle entries, both 0 in background; no disk cache. Biome forbids `useQuery` from `convex/react`. | Same binding as Foundry. Keeps game subscriptions alive across short navigation gaps. |
| Auth gate | Whole app | No signed-in gate. Guests play and join with a local guest id; only hosting an online game asks for sign-in (`HostGate`). | A game's `create` requires an identity for online sessions; joining does not. Matches web. |

## Tests

Jest (jest-expo) runs two kinds of test from `pnpm test`, both next to the code they cover:

- `*.test.ts` for pure logic.
- `*.test.tsx` for a component render test, with `@testing-library/react-native`.
  Lock in a screen's fallback or empty state (for example
  `features/dice/table/dice-table-screen.test.tsx`).

Writing a render test:

- Render with `renderScreen` from `test/render-screen.tsx`; it mounts the locale,
  appearance and safe-area providers a screen expects. `render` is async: `await` it.
- Native and network modules (Clerk, Convex, expo-router, Sentry, haptics, keep-awake)
  are mocked once in `test/native-mocks.ts`, loaded by `jest.setup.ts`. Add a mock
  there when a new test fails to import a module; mock only what that screen needs.
- Steer a mock from the test instead of re-mocking it: Convex data comes from
  `jest.mocked(useQuery).mockReturnValue(...)` (`useQuery` from `src/convex/query-cache`).
- Find things by the words the player sees, read from `messages.en`, so a copy change
  does not break the test. Add a `testID` only when text will not do.
- Do not mock the screen's own hooks or children; mock the boundary beneath them.

## Review and enforcement

`pnpm run check` at the root runs Biome and `scripts/check-mobile-structure.mjs`
(feature filenames, UI-to-feature imports, literal font sizes, and UI text
outside the `src/i18n` catalog). Root
`pnpm run typecheck` and `pnpm test` include `@arcadeclub/core` and `@arcadeclub/mobile`.
Typed routes come from `.expo/types/router.d.ts`. `expo start` regenerates it,
and typecheck also passes without it, as in CI.
