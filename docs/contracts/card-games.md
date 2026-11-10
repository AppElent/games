---
type: contract
description: Read when changing card games (Pesten, Jokeren), the card engine, its stored state, seat claims or card art.
version: 1.0.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing Pesten and
  Jokeren.
- A game is a config file in `packages/core/src/cards/games/` for a rule family
  (`shedding`, `rummy`), so adding one to a family needs no backend or UI code.
- A table is created in one step by `cardGames.createTable`, and joiners claim a seat
  through `ON_JOIN` (`convex/lib/cardSeats.ts`). A seat is proven by a secret the
  device keeps, since participant ids are public.
- Web (`src/components/cards`) and mobile (`apps/mobile/src/features/cards`) draw the
  same card art from `packages/core/src/cards/art.ts` and derive the same table logic
  (names, hints, fresh cards, flights) from `packages/core/src/cards/table-view.ts`.

## Acceptance

- `packages/core/src/__tests__/{cards,card-table-view}.test.ts` and
  `convex/cardGames.test.ts` pass.
