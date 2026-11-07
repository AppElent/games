# Arcade Club mobile coding standards

Apply the shared [mobile coding](../../docs/standards/mobile-coding.md) and
[mobile structure](../../docs/standards/mobile-structure.md) standards. Run and
verify the app with the [mobile runbook](../../docs/runbooks/mobile.md).

## Bindings

- `app/` holds routes only; each route renders one screen from
  `src/features/<game-or-area>/<subject>/`. `src/ui/` holds generic primitives
  and never imports a feature.
- `@arcadeclub/core` owns game rules (Sudoku, Backgammon, Hitster packs and modes).
  Mobile adds only UI state around them, for example
  `src/features/backgammon/local/local-match.ts` (a pure reducer; callers
  pre-roll dice so it stays deterministic).
- Online games call the existing Convex functions unchanged through
  `src/convex/api.ts`. A device's seat in an online session is stored by
  `src/features/sessions/session-seats.ts`. Every game screen resolves its
  `participantId` from there, never from route params. A card table also needs
  the seat's `seatSecret`, which `joinByCode` and `createTable` hand back and the
  same store keeps: a participant id alone is public.
- Local saves (Sudoku puzzles, the one pass-and-play backgammon match) use
  `expo-sqlite/kv-store`. Every store validates parsed data and degrades to "no save"
  instead of throwing.
- `src/feedback/haptics.ts` names haptics by meaning (`moveMade`, `gameWon`).
  Screens do not call `expo-haptics` directly.

## Project decisions

| Rule | Scope | Replacement | Reason |
| --- | --- | --- | --- |
| Convex query caching | Mobile reads | `retention` flavour in `src/convex/query-cache.tsx`: 5 min expiration, 20 idle entries, both 0 in background; no disk cache. Biome forbids `useQuery` from `convex/react`. | Same binding as Foundry. Keeps game subscriptions alive across short navigation gaps. |
| Auth gate | Whole app | No signed-in gate. Guests play and join with a local guest id; only hosting an online game asks for sign-in (`HostGate`). | `sessions.create` requires an identity; joining does not. Matches web. |

## Review and enforcement

`pnpm run check` at the root runs Biome and `scripts/check-mobile-structure.mjs`
(feature filenames, UI-to-feature imports, literal font sizes, and UI text
outside the `src/i18n` catalog). Root
`pnpm run typecheck` and `pnpm test` include `@arcadeclub/core` and `@arcadeclub/mobile`.
Typed routes come from `.expo/types/router.d.ts`. `expo start` regenerates it,
and typecheck also passes without it, as in CI.
