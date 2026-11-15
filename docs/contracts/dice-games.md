---
type: contract
description: Read when changing dice games (Yatzy, Liar's Dice), the dice engine, its rolls, stored state, score sheets or hidden cups.
version: 1.2.0
status: current
---

# Dice games

Dice games add new games as rule configuration, play on the same table machinery as
card games, and look and behave the same on web and mobile. Before changing the
engine, its rolls or stored state, read [the decision](../adr/0003-dice-games-share-the-table-machinery.md).

## Behavior

- One catalog entry (`dice-games`) leads to a hub at `/dice` listing every game in
  `DICE_GAMES` (Yatzy, Liar's Dice).
- A game is a config file in `packages/core/src/dice/games/` for a rule family
  (`scoresheet`, `bidding`). Its house rules are options over its `rules`, off unless
  marked `on` (`initialHouseRules`), shown as switches on the setup screens; options
  that share a `group` exclude each other
  (`setHouseRule` in `packages/core/src/table-engine.ts`). Yatzy's `yahtzeeSheet` swaps the Scandinavian
  15-box sheet for the 13-box Yahtzee sheet with bonus Yahtzees.
- The server rolls every die from fresh randomness on each move and stores no seed;
  the client sends only the indices it keeps, and a roll must reroll at least one die. A score-sheet turn is up to
  `rollsPerTurn` rolls, then one open box; a full sheet ends the game.
- Liar's Dice (`bidding`, 2-6 players, Blufpoker in Dutch): every cup is rolled on the
  server at the start of each round. In turn a player bids a quantity and face over
  all dice on the table, each bid higher than the last (more dice, or as many of a
  higher face), or calls the last bid a lie: if it holds the caller loses a die,
  otherwise the bidder does. The last player with dice wins. House rules: `wildOnes`
  (on at setup; ones count as every face, a bid on ones needs half as many rounded up,
  leaving ones needs twice as many plus one), `spotOn` (an exact count makes everyone
  else lose a die, a wrong one costs the caller a die) and `threeDice`.
- A bidding view carries only the viewer's own cup (`yourDice`) and every seat's dice
  count; other cups appear only in `reveal`, after a call. Spectators see no cup.
- Bluff Dice was liar's dice with every house rule off. Its catalog tile is gone and
  `/bluff-dice/new` opens the Liar's Dice setup. `migrations:bluffDiceToDiceTables`
  moves its sessions onto dice tables with the same seats and state; a guest's guest
  id becomes their seat secret, and `/bluff-dice/$sessionId` hands it to the table.
  Its module, route, `bluffDiceStates` table and game type go once production has run
  the migration.
- A table is created by `diceGames.createTable` and seats work exactly as card seats
  (`convex/lib/tableSeats.ts`): 1 to `players.max` seats, computer players, autopilot
  for silent players, rematch.
- Web (`src/components/dice`) and mobile (`apps/mobile/src/features/dice`) derive turn
  steps, names and standings from `packages/core/src/dice/table-view.ts`. Dice are real
  buttons whose held state screen readers announce, and the score sheet is a table.
  At a bidding table every bid, call and reveal is read out in a live region.

## Acceptance

- `packages/core/src/__tests__/dice.test.ts`, `packages/core/src/__tests__/liars-dice.test.ts`,
  `convex/diceGames.test.ts` and `convex/migrations.test.ts` pass.
- The liar's dice leak test plays whole games over many seeds and finds no view that
  changes when another player's cup does.
