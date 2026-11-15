---
type: decision
description: Read before adding a dice game or family, or changing how table games (cards, dice) store state, seat players or roll dice.
version: 1.0.0
status: accepted
date: 2026-11-15
---

# Run dice games on the card games' table machinery

Arcade Club needs many dice games: Yatzy first, then 10.000, Mexen and
Blufpoker. Like card games they are turn-based tables with seats, invites,
computer players and house rules, and some keep dice hidden (Blufpoker), so a
seat needs the same secret a card seat has. Dice also add one risk cards do
not: a client that chooses its own roll can cheat.

Dice games follow [ADR 0001](0001-card-games-use-rule-families-and-config.md).
Each game is a data definition in `packages/core/src/dice/games/` for a rule
family (`scoresheet` first), listed in `DICE_GAMES`. Both card and dice engines
implement one `TableEngine` contract (`packages/core/src/table-engine.ts`), and
one Convex factory, `tableGameFunctions` in `convex/lib/tableGames.ts`, builds
the table module for each: `convex/cardGames.ts` and `convex/diceGames.ts` are a
few lines each. Dice tables reuse the `cardGameStates` table and the seat
secrets in `convex/lib/tableSeats.ts`, which lists every table engine.

Every roll happens on the server, drawn from the `random` that
`TableEngine.apply` receives, which the Convex module passes as a fresh
`Math.random` on every move (`rollDice` in `packages/core/src/dice/table.ts`).
The state stores no seed, so nothing a client can read predicts the next roll.
A client only says which dice it keeps, as indices the engine validates. Tests
pass a seeded generator instead.

## Consequences

- A new dice game in an existing family is a config file, a `DICE_GAMES`
  entry and messages in both locales, with no backend or UI code.
- A new dice family is a core module and a table component on web and mobile,
  but no new Convex tables or functions.
- A new table game type is one `TABLE_ENGINES` entry, one
  `tableGameFunctions` module, a session policy and its screens.
- Card and dice tables share error codes (`cards*`), the `cardGameStates`
  table name and the web seat storage key (`arcade-club.cards.<sessionId>`).
  Renaming any of them breaks tables and seats already in use.
- Holds stay on the device until the roll, so a reload forgets them. This
  costs nothing the server would need to check.

## Rejected

- A dice table with its own Convex functions: a second copy of seats, bots,
  autopilot, rematch and presence, which would drift from cards.
- A separate `diceGameStates` table: more schema for state the engine already
  validates.
- Client rolls with server checks: a client could still reroll until it liked
  the result.
- One seed stored per game, advanced on each roll: every roll is public, so a
  client could recover a 32-bit seed from a few rolls and predict the rest.
