# Arcade Club mobile coding standards

Apply the shared [mobile coding](../../docs/standards/mobile-coding.md) and
[mobile structure](../../docs/standards/mobile-structure.md) standards. Run and
verify the app with the [mobile runbook](../../docs/runbooks/mobile.md).

## Bindings

- `app/` holds routes only; each route renders one screen from
  `src/features/<game-or-area>/<subject>/`. `src/ui/` holds generic primitives
  and never imports a feature.
- `@games/core` owns game rules (Sudoku, Backgammon, Hitster packs and modes).
  Mobile adds only UI state around them, for example
  `src/features/backgammon/local/local-match.ts` (a pure reducer; callers
  pre-roll dice so it stays deterministic).
- Online games call the existing Convex functions unchanged through
  `src/convex/api.ts`. A device's seat in an online session is stored by
  `src/features/sessions/session-seats.ts`. Every game screen resolves its
  `participantId` from there, never from route params.
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
| i18n catalogs | Mobile | App-owned en/nl catalogs in `src/i18n/messages/`; the plan's shared catalogs in `@games/core` were not adopted. Parity is a Jest test (`src/test-support/message-parity.ts`), not Vitest. | Mobile copy is shorter and phone-specific. Web copy did not translate 1:1. |
| Hitster mode copy | Mobile | Mode labels and summaries are localized in the mobile catalog; `@games/core/hitster` stays English. | Core mode copy is English-only and web-shaped. |
| Server error text | Mobile | `ConvexError` messages are English and not shown; screens show a localized generic notice (for example `hitster.room.actionFailed`). | No stable error codes yet. Adding them is a backend change for web and mobile. |
| Error reporting | Mobile v1 | Sentry not wired yet. | No DSN or project exists for the app. Add it with the shared Sentry feature before the first store build. |
| Font scaling on boards | Backgammon board | Point numbers and checker counts cap `maxFontSizeMultiplier` at 1.2. | The text sits in fixed board geometry; the accessibility labels carry the full information. |

## Review and enforcement

`pnpm run check` at the root runs Biome and `scripts/check-mobile-structure.mjs`
(feature filenames, UI-to-feature imports, literal font sizes). Root
`pnpm run typecheck` and `pnpm test` include `@games/core` and `@games/mobile`.
Typed routes come from `.expo/types/router.d.ts`. `expo start` regenerates it,
and typecheck also passes without it, as in CI.
