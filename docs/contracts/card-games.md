---
type: contract
description: Read when changing card games (Pesten, Mau-Mau, Jokeren, Eenentwintigen, Hartenjagen, Gin Rummy), the card engine, its stored state, seat claims or card art.
version: 1.3.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing every game in
  `CARD_GAMES` (Pesten, Mau-Mau, Jokeren, Eenentwintigen, Hartenjagen, Gin Rummy).
- A game is a config file in `packages/core/src/cards/games/` for a rule family
  (`shedding`, `rummy`, `bank`, `tricks`, `gin`), so adding one to a family needs no
  backend or UI code.
- A view never holds another seat's hand. In gin the opponent's cards stay hidden until
  a knock lays the knocker's melds and deadwood face up, and the hand result shows both
  hands once it is scored.
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

## Trick-taking (`tricks`)

`packages/core/src/cards/tricks.ts` deals the deck out, optionally passes cards, then
plays tricks: the first card sets the suit, others must follow it if they can, and the
highest card of that suit (or the highest trump) takes the trick and leads the next.
When the hands are empty the deal is scored; the match ends after the deal in which
someone reaches `target`.

A game sets these `TricksRules` fields:

| Field | What it decides | Hartenjagen |
| --- | --- | --- |
| `ranks` | Rank order, low to high, and which ranks are dealt | 2 to A, full deck |
| `stripped` | Faces removed per seat count, so the deck divides evenly | 3: D2; 5: D2 C3; 6: D2 C3 D3 C4 |
| `passing` | Cards passed before a deal and the direction cycle; null for none | 3, left/right/across/keep |
| `firstLead` | The face that opens each deal; null means left of the dealer leads | C2 |
| `breaking` | A suit nobody leads until it has been played, and faces that also break it | hearts |
| `schedule` | Which function in `SCHEDULES` sets each seat's hand size per deal; cards left over stay undealt | `fullDeck` |
| `trumpChoice` | Which function in `TRUMPS` picks a deal's trump suit from the undealt cards | `none` |
| `seating` | Which function in `SEATINGS` puts seats into teams; partners share a total | `alone` |
| `scoring` | Which function in `SCORERS` turns tricks taken into points | `penaltyCards` |
| `suitPoints`, `cardPoints` | Points per card; a face overrides its suit | hearts 1, SQ 13 |
| `shootTheMoon` | Taking every positive card gives their total to everyone else | on |
| `target` | When the match ends; the lowest total wins | 100 |

House rules are shallow patches on these fields, as in the other families.

- Privacy: `viewTricks` shows a seat only its own hand, the cards it set aside to pass
  and the cards it was passed. Trick cards and cards taken were played face up.
- Passing is simultaneous: each seat chooses, and the exchange happens once every seat
  has. "Across" is skipped for an odd number of seats.
- The bot ducks under the winning card, dumps its most dangerous card when it cannot
  follow, and passes its most dangerous cards. It never plays an illegal card.

### Extension points for later games

Boerenbridge, Toepen and Klaverjassen need these. The strategy maps (`SCHEDULES`,
`TRUMPS`, `SEATINGS`, `SCORERS`) hold only what Hartenjagen uses; a later game adds an
entry and names it in its rules. The rest are new fields with a default that keeps
Hartenjagen unchanged, not a new family.

- **Rank order**: `ranks` already decides strength and the deck. Toepen sets
  `["J","Q","K","A","7","8","9","10"]` and gets its 32-card deck from that.
- **Trump**: `trickWinner` honours `TricksState.trump`, which `trumpChoice` sets per
  deal. Boerenbridge adds a `TRUMPS` entry that turns up an undealt card; Klaverjassen
  has a seat choose it in a phase of its own, and a `trumpRanks` order covers its
  J 9 A 10 K Q 8 7.
- **Follow rules**: `legalTricksCards` is the single place that decides legal cards,
  so must-trump and must-overtrump are a rule switch read there.
- **Team seating**: a `SEATINGS` entry such as opposite seats as partners. The match
  already ends and is won on team totals. The view still shows totals per seat, so a
  team game adds team totals to `TricksView`.
- **Round schedule**: a `SCHEDULES` entry for Boerenbridge's rising and falling hands,
  from the seat count and round. With cards left undealt the `firstLead` card may be in
  no hand, so such a game sets `firstLead` to null.
- **Bidding and stakes**: a phase before `playing`, like `passing`, with its own action
  and refusal codes (Boerenbridge bids, Toepen knocks).
- **Scoring**: a new entry in `SCORERS` (tricks against bid, last trick only, team
  points plus roem).
- **Trick history**: `taken` keeps each seat's cards, not each trick. Roem is scored
  per trick, so Klaverjassen keeps the tricks themselves for its scorer.
- **Must trump**: a void seat may play anything today. Klaverjassen's must-trump and
  must-overtrump read `seating` too, since a partner already winning lifts them.
- **Match end**: `scoreDeal` ends at `target` with the lowest total winning. A
  match-end rule covers a fixed number of deals with the highest total winning
  (Boerenbridge, Klaverjassen) and Toepen's elimination.

## Acceptance

- `packages/core/src/__tests__/{cards,cards-bank,card-table-view,tricks}.test.ts` and
  `convex/cardGames.test.ts` pass.
