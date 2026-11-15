---
type: contract
description: Read when changing dice games (Yatzy), the dice engine, its rolls, stored state or score sheets.
version: 1.0.0
status: current
---

# Dice games

Dice games add new games as rule configuration, play on the same table machinery as
card games, and look and behave the same on web and mobile. Before changing the
engine, its rolls or stored state, read [the decision](../adr/0003-dice-games-share-the-table-machinery.md).

## Behavior

- One catalog entry (`dice-games`) leads to a hub at `/dice` listing every game in
  `DICE_GAMES` (Yatzy).
- A game is a config file in `packages/core/src/dice/games/` for a rule family
  (`scoresheet`). Its house rules are options over its `rules`, off by default, shown
  as switches on the setup screens. Yatzy's `yahtzeeSheet` swaps the Scandinavian
  15-box sheet for the 13-box Yahtzee sheet with bonus Yahtzees.
- The server rolls every die from fresh randomness on each move and stores no seed;
  the client sends only the indices it keeps, and a roll must reroll at least one die. A score-sheet turn is up to
  `rollsPerTurn` rolls, then one open box; a full sheet ends the game.
- A table is created by `diceGames.createTable` and seats work exactly as card seats
  (`convex/lib/tableSeats.ts`): 1 to `players.max` seats, computer players, autopilot
  for silent players, rematch.
- Web (`src/components/dice`) and mobile (`apps/mobile/src/features/dice`) derive turn
  steps, names and standings from `packages/core/src/dice/table-view.ts`. Dice are real
  buttons whose held state screen readers announce, and the score sheet is a table.

## Acceptance

- `packages/core/src/__tests__/dice.test.ts` and `convex/diceGames.test.ts` pass.
