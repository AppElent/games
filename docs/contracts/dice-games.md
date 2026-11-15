---
type: contract
description: Read when changing dice games (Yatzy, 10.000), the dice engine, its rolls, stored state, score sheets or push-your-luck turns.
version: 1.2.0
status: current
---

# Dice games

Dice games add new games as rule configuration, play on the same table machinery as
card games, and look and behave the same on web and mobile. Before changing the
engine, its rolls or stored state, read [the decision](../adr/0003-dice-games-share-the-table-machinery.md).

## Behavior

- One catalog entry (`dice-games`) leads to a hub at `/dice` listing every game in
  `DICE_GAMES` (Yatzy, 10.000).
- A game is a config file in `packages/core/src/dice/games/` for a rule family
  (`scoresheet`, `pushluck`). Its house rules are options over its `rules`, off by default, shown
  as switches on the setup screens; options that share a `group` exclude each other
  (`setHouseRule` in `packages/core/src/table-engine.ts`). Yatzy's `yahtzeeSheet` swaps the Scandinavian
  15-box sheet for the 13-box Yahtzee sheet with bonus Yahtzees. 10.000's switches set
  an opening score (350 or 500), fixed points for four to six alike, drop three pairs
  or the straight, and drop the final round.
- The server rolls every die from fresh randomness on each move and stores no seed;
  the client sends only the indices it keeps, and a roll must reroll at least one die. A score-sheet turn is up to
  `rollsPerTurn` rolls, then one open box; a full sheet ends the game.
- A push-your-luck turn (`pushluck`) rolls all `dice`, then each move sets aside scoring
  dice and either rolls the rest or banks the turn total. Every die set aside must score
  (`scoreSetAside`), a roll with nothing that scores busts the turn, and all dice set aside
  roll again as hot dice. Reaching `target` gives everyone else one final turn when
  `finalRound` is on; the highest score wins and equal scores share the win.
- A table is created by `diceGames.createTable` and seats work exactly as card seats
  (`convex/lib/tableSeats.ts`): up to `players.max` seats, computer players, autopilot
  for silent players, rematch. A game with `players.min` above 1 (10.000 needs two)
  starts only once that many seats are filled.
- Web (`src/components/dice`) and mobile (`apps/mobile/src/features/dice`) derive turn
  steps, picks, names and standings from `packages/core/src/dice/table-view.ts`. Dice are
  real buttons whose held or set-aside state screen readers announce, and the score sheet
  is a table.

## Acceptance

- `packages/core/src/__tests__/dice.test.ts`, `packages/core/src/__tests__/dice-pushluck.test.ts`
  and `convex/diceGames.test.ts` pass.
