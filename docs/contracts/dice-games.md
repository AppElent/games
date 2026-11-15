---
type: contract
description: Read when changing dice games (Yatzy, Mexen), the dice engine, its rolls, stored state, score sheets or rounds with lives.
version: 1.2.0
status: current
---

# Dice games

Dice games add new games as rule configuration, play on the same table machinery as
card games, and look and behave the same on web and mobile. Before changing the
engine, its rolls or stored state, read [the decision](../adr/0003-dice-games-share-the-table-machinery.md).

## Behavior

- One catalog entry (`dice-games`) leads to a hub at `/dice` listing every game in
  `DICE_GAMES` (Yatzy, Mexen).
- A game is a config file in `packages/core/src/dice/games/` for a rule family
  (`scoresheet`, `mexen`). Its house rules are options over its `rules`, off by default, shown
  as switches on the setup screens; options that share a `group` exclude each other
  (`setHouseRule` in `packages/core/src/table-engine.ts`). Yatzy's `yahtzeeSheet` swaps the Scandinavian
  15-box sheet for the 13-box Yahtzee sheet with bonus Yahtzees.
- The server rolls every die from fresh randomness on each move and stores no seed;
  the client sends only the indices it keeps, and a roll must reroll at least one die. A score-sheet turn is up to
  `rollsPerTurn` rolls, then one open box; a full sheet ends the game.
- A Mexen round (`packages/core/src/dice/mexen.ts`): two dice read high die first
  (6-3 is 63); Mex (2-1) beats doubles, which beat 65 down to 31. The round's
  first player throws up to `maxThrows` times and their count caps everyone
  else; a `stand` keeps the last throw, and the last throw allowed is kept
  without one. The lowest kept throw pays one life (two when a Mex was kept and
  `mexDoubles` is on); ties throw off with one throw each until one is lowest.
  The loser leads the next round. In `lives` scoring a player with none left is
  out (standings rank a later exit higher) and the last one in wins; in `points` scoring nobody drops out, the game
  ends when someone reaches `lives` points, and the fewest points win. House
  rules switch the lives (3/6/10), Mex doubling, Little Mex (3-1 ranks just
  under Mex, as in Meyer) and points scoring. Its events are prefixed `mexen`
  so other families' news never reads them.
- A table is created by `diceGames.createTable` and seats work exactly as card seats
  (`convex/lib/tableSeats.ts`): 1 to `players.max` seats, computer players, autopilot
  for silent players, rematch.
- Web (`src/components/dice`) and mobile (`apps/mobile/src/features/dice`) derive turn
  steps, names and standings from `packages/core/src/dice/table-view.ts`. Dice are real
  buttons whose held state screen readers announce, and the score sheet is a table.

## Acceptance

- `packages/core/src/__tests__/dice.test.ts`, `packages/core/src/__tests__/mexen.test.ts`,
  `convex/diceGames.test.ts` and `convex/diceGames.mexen.test.ts` pass.
