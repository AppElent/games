---
type: contract
description: Read when changing which games the Arcade Club mobile app offers, or how it talks to Convex and stores seats and saves.
version: 1.4.0
status: current
---

# Mobile app

`apps/mobile` is the Expo app **Arcade Club** (`com.appelent.arcadeclub`, scheme
`arcadeclub`), a second Convex client for a subset of the games. Before native changes
read [mobile coding standards](../../apps/mobile/CODING_STANDARDS.md) and the
[mobile design system](../../apps/mobile/DESIGN_SYSTEM.md); to run or verify it, see
the [mobile runbook](../runbooks/mobile.md).

## Behavior

- The app offers Sudoku (solo, saved to the account when signed in), Backgammon (local pass-and-play and online
  challenge), Music Timeline (id `hitster`, online room) and card games (Pesten, Mau-Mau,
  Jokeren, Eenentwintigen, Hartenjagen, Klaverjassen and Gin Rummy, against bots or in an online room). The other games are web-only for now
  (`pending-port`, [ADR 0002](../adr/0002-ship-every-game-on-web-and-mobile.md)) and
  not listed; a new game ships on both.
- Music Timeline is never shown under the trademarked name Hitster.
- `packages/core/src/features.ts` decides which games are on the app.
  `apps/mobile/src/features/play/app-games.ts` (`APP_GAMES`) holds exactly those games
  with the app's wiring: it drives the Play tab, Continue, which sessions the app
  opens, and each online game's `create` mutation (`backgammon.create`,
  `hitster.create`, `cardGames.createTable`, `diceGames.createTable`) for `useHostSession`.
- A join for a game the app cannot play opens the web join page in an in-app browser
  (`openWebPage`), never `Linking.openURL`, so the universal link cannot loop
  back into the app.
- The app calls the same Convex functions as web, only via
  `apps/mobile/src/convex/api.ts`. It stores its seats (with a card or dice table's
  seat secret) and local saves in `expo-sqlite/kv-store`, and shares web `/join?token=`
  links. A signed-in player's seat also comes back from their account
  (`sessions.ownSeat`, see [game sessions](game-sessions.md); at a card or dice table,
  with its secret, through `reclaimSeat`, see [card games](card-games.md)). On iOS the
  Production and Preview builds open those links themselves (universal links,
  `apps/mobile/src/lib/app-links.ts`, [ADR 0002](../adr/0002-ship-every-game-on-web-and-mobile.md#universal-links)).
- The Play tab's Continue list is this phone's saves and seats. A signed-in player's
  open games from any device join it, read from `sessions.listParticipation`; a seat
  the phone holds wins over the account's row, and removing an account game only hides
  it on this phone. A guest keeps the phone-only list.
- Sudoku saves on the phone first, so play works offline. A guest's puzzles stay on
  the phone. A signed-in player's puzzles also go to their account through the web's
  `api.sudoku` functions (`saves/sudoku-cloud-sync.ts`, mounted at the root): each
  save carries a cloud link (account, session id once `create` answered, synced or
  not). Guest saves become the account's on sign-in and upload once; nothing is
  removed until the server confirmed. `create` is made idempotent on the phone: a
  create with no answer is first looked up in the account (`listParticipation`, same
  title and givens) before another is sent. The Sudoku list shows the account's
  sessions (web ones too) beside the phone's pending puzzles; removing an account
  puzzle only hides it on that device. The web's list shows the account's sessions
  the same way.
- On iOS, Sudoku scans a paper puzzle from the camera or the photo library
  (`/sudoku/scan`). Apple Vision finds the grid and reads digits on the device
  (local module `apps/mobile/modules/sudoku-scanner`); which cells hold ink, and
  what it means, is `@arcadeclub/core/sudoku-scan-ink`, shared with the web. The
  player checks the grid in the web's verify step before it becomes a classic
  save with `source: "scan"` and no difficulty or solution. A build without the
  module (Android, or an older iOS build on a newer update) hides the entry and
  sends `/sudoku/scan` back to Sudoku.

## Acceptance

- `scripts/app-links.test.ts` and `apps/mobile/src/lib/app-links-config.test.ts`
  (claimed links, the AASA file, and each variant's associated domains),
- `apps/mobile/src/features/sudoku/saves/sudoku-cloud-sync.test.ts` and
  `sudoku-save-store.test.ts` (offline, retry, idempotent create, guest saves,
  upload before removal),
- `apps/mobile/src/features/play/app-games.test.ts` (including that `APP_GAMES`
  matches the games `features.ts` lists on mobile),
  `apps/mobile/src/features/sessions/session-links.test.ts` and
  `apps/mobile/src/features/sessions/session-seats.test.ts` pass.
