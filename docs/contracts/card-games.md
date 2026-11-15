---
type: contract
description: Read when changing card games (Pesten, Mau-Mau, Jokeren, Hartenjagen, Gin Rummy, Toepen), the card engine, its stored state, seat claims or card art.
version: 1.3.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing every game in
  `CARD_GAMES` (Pesten, Mau-Mau, Jokeren, Hartenjagen, Gin Rummy, Toepen).
- A game is a config file in `packages/core/src/cards/games/` for a rule family
  (`shedding`, `rummy`, `tricks`, `gin`), so adding one to a family needs no backend
  or UI code.
- A view never holds another seat's hand. In gin the opponent's cards stay hidden until
  a knock lays the knocker's melds and deadwood face up, and the hand result shows both
  hands once it is scored.
- House rules are options over a game's `rules`, off by default. An option with
  `withoutPowers` turns those special cards into plain cards, so a shedding game offers
  one such option per special card and the setup screens list them under "Special
  cards" (`specialCards` in `table-view.ts`). An option with `append` adds items to a
  list field instead of replacing it, so two such options combine (Toepen's vuile
  was and armoede each add a kind of hand that may be swapped).
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
someone reaches `target`, or, with `matchEnd: "lastStanding"`, seats drop out at
`target` and the last one in wins.

A game sets these `TricksRules` fields:

| Field | What it decides | Hartenjagen | Toepen |
| --- | --- | --- | --- |
| `ranks` | Rank order, low to high, and which ranks are dealt | 2 to A, full deck | J Q K A 7 8 9 10 (32 cards) |
| `stripped` | Faces removed per seat count, so the deck divides evenly | 3: D2; 5: D2 C3; 6: D2 C3 D3 C4 | none |
| `passing` | Cards passed before a deal and the direction cycle; null for none | 3, left/right/across/keep | null |
| `firstLead` | The face that opens each deal; null means left of the dealer leads | C2 | null |
| `breaking` | A suit nobody leads until it has been played, and faces that also break it | hearts | null |
| `schedule` | Which function in `SCHEDULES` sets each seat's hand size per deal; cards left over stay undealt | `fullDeck` | `fourEach` |
| `trumpChoice` | Which function in `TRUMPS` picks a deal's trump suit from the undealt cards | `none` | `none` |
| `seating` | Which function in `SEATINGS` puts seats into teams; partners share a total | `alone` | `alone` |
| `scoring` | Which function in `SCORERS` turns tricks taken into points | `penaltyCards` | `lastTrick` |
| `suitPoints`, `cardPoints` | Points per card; a face overrides its suit | hearts 1, SQ 13 | none |
| `shootTheMoon` | Taking every positive card gives their total to everyone else | on | off |
| `target` | The total that ends the match, or puts a seat out | 100 | 10 |
| `matchEnd` (optional) | `lowestAtTarget`: the lowest total wins once someone reaches `target`; `lastStanding`: seats drop out at `target`, are dealt nothing, and the last one in wins | default | `lastStanding` |
| `knocking` (optional) | Stakes: each deal starts at 1 and any seat may knock to raise it (below); `lastLife` starts a deal at 2 while someone is one point from out | absent | `{ lastLife: false }` |
| `swapHands` (optional) | Rank sets: a hand made only of one set's ranks may be swapped for undealt cards before the deal's first card | absent | empty; house rules append to it |

House rules are shallow patches on these fields, as in the other families.

- Privacy: `viewTricks` shows a seat only its own hand, the cards it set aside to pass
  and the cards it was passed. Trick cards and cards taken were played face up.
- Passing is simultaneous: each seat chooses, and the exchange happens once every seat
  has. "Across" is skipped for an odd number of seats.
- The bot ducks under the winning card, dumps its most dangerous card when it cannot
  follow, and passes its most dangerous cards. It never plays an illegal card. Under
  `lastTrick` it spends its weakest legal card and keeps the best for the last trick.

### Stakes (`knocking`)

- Any seat still in the deal may knock at any time while cards are being played, not
  only on its turn. The stake rises by 1 and the deal moves to the `knocking` phase:
  every other seat still in answers `stay` or `fold`, asked from the knocker's left.
  Nobody plays until all have answered; answers are public as they come.
- A seat may not knock twice in a row (`cardsKnockedLast`), nor once its total plus
  the stake reaches `target` under `lastStanding` (`cardsKnockAtLimit`).
- Folding costs the stake from before the raise, at once (`paid`), and the seat's
  hand and any card it has in the open trick go face down (`mucked`). If only one
  seat is left, it wins the deal on the spot. Otherwise play resumes; if the seat to
  play folded, the next seat still in plays, and a trick everyone left has played to
  is taken.
- Swapping (`swapHands`): before the deal's first card, a seat whose hand is made only
  of one set's ranks may swap it for undealt cards, face down. A new hand that
  qualifies again may be swapped again while undealt cards last.
- `lastTrick` scoring: the winner of the last trick, or the last seat in, wins; every
  other seat still in loses the stake.
- The bot knocks with cards no unseen card of their suit can beat (now and then
  without, so a knock is not a tell), stays in with such a card or a strong rank,
  stays when folding would put it out anyway, and swaps a hand of only weak cards.
- Privacy: `stock` and `mucked` never reach a view.
- Older tables: the new state fields are optional, so Hartenjagen tables dealt before
  them still read.

### Extension points for later games

Boerenbridge and Klaverjassen need these; Toepen used the rank order, schedule, stakes,
scoring and match-end points. The strategy maps (`SCHEDULES`, `TRUMPS`, `SEATINGS`,
`SCORERS`) hold only what the listed games use; a later game adds an entry and names
it in its rules. The rest are new optional fields whose absence keeps the existing
games unchanged, not a new family.

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
- **Bidding and stakes**: a phase before or during `playing`, like `passing`, with its
  own action and refusal codes. Toepen's `knocking` phase is the stakes example;
  Boerenbridge bids.
- **Scoring**: a new entry in `SCORERS` (tricks against bid, team points plus roem).
  Toepen added `lastTrick`, which also names the deal's winner.
- **Trick history**: `taken` keeps each seat's cards, not each trick. Roem is scored
  per trick, so Klaverjassen keeps the tricks themselves for its scorer.
- **Must trump**: a void seat may play anything today. Klaverjassen's must-trump and
  must-overtrump read `seating` too, since a partner already winning lifts them.
- **Match end**: `matchEnd` holds `lowestAtTarget` and Toepen's `lastStanding`. A
  fixed number of deals with the highest total winning (Boerenbridge, Klaverjassen)
  is another value there.

## Acceptance

- `packages/core/src/__tests__/{cards,card-table-view,tricks,toepen}.test.ts` and
  `convex/cardGames.test.ts` pass.
