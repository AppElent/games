---
type: contract
description: Read when changing card games (Pesten, Mau-Mau, Jokeren, Eenentwintigen), the card engine, its stored state, seat claims or card art.
version: 1.1.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing every game in
  `CARD_GAMES` (Pesten, Mau-Mau, Jokeren, Eenentwintigen).
- A game is a config file in `packages/core/src/cards/games/` for a rule family
  (`shedding`, `rummy`, `bank`), so adding one to a family needs no backend or UI code.
- House rules are options over a game's `rules`, off by default. An option with
  `withoutPowers` turns those special cards into plain cards, so a shedding game offers
  one such option per special card and the setup screens list them under "Special
  cards" (`specialCards` in `table-view.ts`). Options that share a `group` exclude
  each other, such as match lengths; `toggleOption` keeps the setup screens to one,
  and the server refuses two.
- In the `bank` family every seat plays its own hand against a computer bank that is
  part of the game state, not a seat. Players pick a stake from a fixed set of points
  each round, and the bank's face-down card stays hidden until the bank plays. Text
  speaks of points only, never money or betting.
- A table is created in one step by `cardGames.createTable`, and joiners claim a seat
  through `ON_JOIN` (`convex/lib/cardSeats.ts`). A seat is proven by a secret the
  device keeps, since participant ids are public.
- Web (`src/components/cards`) and mobile (`apps/mobile/src/features/cards`) draw the
  same card art from `packages/core/src/cards/art.ts` and derive the same table logic
  (names, hints, fresh cards, flights) from `packages/core/src/cards/table-view.ts`.

## Acceptance

- `packages/core/src/__tests__/{cards,cards-bank,card-table-view}.test.ts` and
  `convex/cardGames.test.ts` pass.
