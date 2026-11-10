---
type: contract
description: Read when changing how online games create, join, seat, start, finish or reopen a session, or how a game route renders.
version: 1.0.0
status: current
---

# Game sessions

Every online game shares one session model, so hosting, joining and seat checks work
the same in each game and on web and mobile. To add a game, use the `add-new-game`
skill.

## Behavior

- All online games share one `gameSessions` + `sessionParticipants` pair of tables
  (`convex/schema.ts`). Game ids, join modes (`room` code, `challenge` share link,
  `solo`) and auth policies are `as const` arrays in `packages/core/src/games.ts`, and
  the Convex validators derive from them.
- Word Links and Squad Surge play locally with no session.
- Each game's Convex module (`convex/<game>.ts`) owns its state table, keyed by
  `sessionId`, and creates session, host and state in one `create` mutation through
  `convex/lib/hostedSession.ts`.
- `convex/lib/gameSession.ts` is the one owner of loading, starting, finishing and
  reopening a session. The two-seat games (backgammon, chess, connect four) share
  seats, turns and rematches through their `Duel` descriptor in `convex/lib/duel.ts`.
- Rules live in `packages/core` (`@arcadeclub/core`, pure, no dependencies), which
  throws `GameRuleError`. Convex wraps rule calls in `rules()` and throws keyed
  `gameError(code)`; clients localize the code from `serverErrors`. Chess rules wrap
  `chess.js` in their own package, `packages/chess` (`@arcadeclub/chess`), so core
  stays dependency-free.

### Joining and seats

- Joining goes through `sessions.joinByCode` (room code) or `sessions.joinByToken`
  (share link). Both admit a `sessionParticipants` row via `convex/lib/join.ts`, whose
  `ON_JOIN` map holds each game's hook (seating a challenger, claiming a card seat), so
  `convex/sessions.ts` names no game.
- Participants are signed-in users (`userId`) or guests (`guestId`, generated
  client-side). Read identity with `getOptionalUserId`/`requireUserId` from
  `convex/lib/auth.ts`.
- Participant ids are public, so every call acting for a seat takes `seatArgs` and
  proves the seat is the caller's with `requireOwnParticipant` (or `requireHost`) from
  `convex/lib/gameSession.ts`: the same account, or for a guest, the same guest id.

### Web client

- `src/lib/games/catalog.ts` lists every game with its route and `sessionPath` (where
  a seated player plays, used by `/join`). Display text is in
  `packages/core/src/i18n/*/catalog.ts`; `getLocalizedGame` joins the two.
- A tab's seat per session is `src/lib/games/seat.ts`. `NewGamePage`/`useHostSession`
  host a game, `SessionBundleRoute` renders a session route off the game's
  `getBundle`, and `useGameAction` runs mutations with localized errors.
- Every game runs fullscreen: game routes set `staticData: { fullscreen: true }`
  (typed in `src/lib/router-static-data.ts`), which `src/routes/__root.tsx` reads to
  hide the header and footer. Screens render inside `FullscreenGameShell`
  (viewport-filling, pause menu), `FullscreenGamePage` (scrolling lobbies and forms) or
  `FitScale` (fixed-size boards scaled to the viewport), all in
  `src/components/games/`.

## Out of scope

- Card-game tables, which add a seat secret: [card games](card-games.md).

## Acceptance

- `convex/sessions.test.ts` and each `convex/<game>.test.ts` cover create, join and
  seat checks; `src/lib/games/__tests__/{seat,use-host-session,use-game-action,catalog}`
  cover the web client.
