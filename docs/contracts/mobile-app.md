---
type: contract
description: Read when changing which games the Arcade Club mobile app offers, or how it talks to Convex and stores seats and saves.
version: 1.0.0
status: current
---

# Mobile app

`apps/mobile` is the Expo app **Arcade Club** (`com.appelent.arcadeclub`, scheme
`arcadeclub`), a second Convex client for a subset of the games. Before native changes
read [mobile coding standards](../../apps/mobile/CODING_STANDARDS.md) and the
[mobile design system](../../apps/mobile/DESIGN_SYSTEM.md); to run or verify it, see
the [mobile runbook](../runbooks/mobile.md).

## Behavior

- The app offers Sudoku (local), Backgammon (local pass-and-play and online
  challenge), Music Timeline (id `hitster`, online room) and card games (Pesten and
  Jokeren, against bots or in an online room). Other games are web-only and not listed.
- Music Timeline is never shown under the trademarked name Hitster.
- `apps/mobile/src/features/play/app-games.ts` (`APP_GAMES`) lists the app's games: it
  drives the Play tab, Continue, which sessions the app opens, and each online game's
  `create` mutation (`backgammon.create`, `hitster.create`, `cardGames.createTable`)
  for `useHostSession`.
- The app calls the same Convex functions as web, only via
  `apps/mobile/src/convex/api.ts`. It stores its seats (with a card table's seat
  secret) and local saves in `expo-sqlite/kv-store`, and shares web `/join?token=`
  links.

## Acceptance

- `apps/mobile/src/features/play/app-games.test.ts` and
  `apps/mobile/src/features/sessions/session-seats.test.ts` pass.
