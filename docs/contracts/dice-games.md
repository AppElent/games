---
type: contract
description: Read when changing dice games (Yatzy, 10.000, Mexen, Liar's Dice), the dice engine, its rolls, stored state, score sheets, push-your-luck turns, rounds with lives or hidden cups.
version: 1.5.0
status: current
---

# Dice games

Dice games add new games as rule configuration, play on the same table machinery as
card games, and look and behave the same on web and mobile. Before changing the
engine, its rolls or stored state, read [the decision](../adr/0003-dice-games-share-the-table-machinery.md).

## Behavior

- One catalog entry (`dice-games`) leads to a hub at `/dice` listing every game in
  `DICE_GAMES` (Yatzy, 10.000, Mexen, Liar's Dice).
- A game is a config file in `packages/core/src/dice/games/` for a rule family
  (`scoresheet`, `pushluck`, `mexen`, `bidding`). Its house rules are options over its
  `rules`, off unless marked `on` (`initialHouseRules`), shown as switches on the setup
  screens; options that share a `group` exclude each other
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
  `/bluff-dice` and `/bluff-dice/new` open the Liar's Dice setup; its existing rooms
  still play at `/bluff-dice/$sessionId` until they move to dice tables.
- A table is created by `diceGames.createTable` and seats work exactly as card seats
  (`convex/lib/tableSeats.ts`), `diceGames.reclaimSeat` included: up to `players.max` seats, computer players, autopilot
  for silent players, rematch. A game with `players.min` above 1 (10.000 needs two)
  starts only once that many seats are filled.
- Web (`src/components/dice`) and mobile (`apps/mobile/src/features/dice`) derive turn
  steps, picks, names and standings from `packages/core/src/dice/table-view.ts`. Dice are
  real buttons whose held or set-aside state screen readers announce, and the score sheet
  is a table. At a bidding table every bid, call and reveal is read out in a live region.

## Acceptance

- `packages/core/src/__tests__/dice.test.ts`, `packages/core/src/__tests__/dice-pushluck.test.ts`,
  `packages/core/src/__tests__/mexen.test.ts`, `packages/core/src/__tests__/liars-dice.test.ts`,
  `convex/diceGames.test.ts` and `convex/diceGames.mexen.test.ts` pass.
- The liar's dice leak test plays whole games over many seeds and finds no view that
  changes when another player's cup does.
