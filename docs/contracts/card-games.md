---
type: contract
description: Read when changing card games (Pesten, Mau-Mau, Jokeren, Hartenjagen, Gin Rummy, Boerenbridge), the card engine, its stored state, seat claims or card art.
version: 1.3.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing every game in
  `CARD_GAMES` (Pesten, Mau-Mau, Jokeren, Hartenjagen, Gin Rummy, Boerenbridge).
- A game is a config file in `packages/core/src/cards/games/` for a rule family
  (`shedding`, `rummy`, `tricks`, `gin`), so adding one to a family needs no backend
  or UI code.
- A view never holds another seat's hand. In gin the opponent's cards stay hidden until
  a knock lays the knocker's melds and deadwood face up, and the hand result shows both
  hands once it is scored.
- House rules are options over a game's `rules`, off by default. An option with
  `withoutPowers` turns those special cards into plain cards, so a shedding game offers
  one such option per special card and the setup screens list them under "Special
  cards" (`specialCards` in `table-view.ts`).
- Two house rules that patch the same rule field (Boerenbridge's only up and only
  down) can't both be on: `switchOption` turns the other off on both setup screens,
  and `normalizeOptions` refuses the pair with `cardsOptionsClash`. Patches are
  shallow, so a second option that patches `bidding` clashes with `dealerFree`;
  give it a field of its own instead.
- A table is created in one step by `cardGames.createTable`, and joiners claim a seat
  through `ON_JOIN` (`convex/lib/cardSeats.ts`). A seat is proven by a secret the
  device keeps, since participant ids are public.
- Web (`src/components/cards`) and mobile (`apps/mobile/src/features/cards`) draw the
  same card art from `packages/core/src/cards/art.ts` and derive the same table logic
  (names, hints, fresh cards, flights) from `packages/core/src/cards/table-view.ts`.

## Trick-taking (`tricks`)

`packages/core/src/cards/tricks.ts` deals the hands, optionally passes cards or takes
bids, then plays tricks: the first card sets the suit, others must follow it if they
can, and the highest card of that suit (or the highest trump) takes the trick and
leads the next. When the hands are empty the deal is scored; the match ends after the
deal in which someone reaches `target`, or after the schedule's last deal.

A game sets these `TricksRules` fields:

| Field | What it decides | Hartenjagen | Boerenbridge |
| --- | --- | --- | --- |
| `ranks` | Rank order, low to high, and which ranks are dealt | 2 to A, full deck | 2 to A, full deck |
| `stripped` | Faces removed per seat count, so the deck divides evenly | 3: D2; 5: D2 C3; 6: D2 C3 D3 C4 | none |
| `passing` | Cards passed before a deal and the direction cycle; null for none | 3, left/right/across/keep | null |
| `firstLead` | The face that opens each deal; null means left of the dealer leads | C2 | null |
| `breaking` | A suit nobody leads until it has been played, and faces that also break it | hearts | null |
| `schedule` | Which function in `SCHEDULES` sets each seat's hand size per deal; cards left over stay undealt, and a schedule with no next deal ends the match | `fullDeck` | `upDown` (`up`, `down`) |
| `trumpChoice` | Which function in `TRUMPS` picks a deal's trump suit from the undealt cards | `none` | `turnUp` |
| `seating` | Which function in `SEATINGS` puts seats into teams; partners share a total | `alone` | `alone` |
| `scoring` | Which function in `SCORERS` turns tricks taken into points | `penaltyCards` | `bids` |
| `suitPoints`, `cardPoints` | Points per card; a face overrides its suit | hearts 1, SQ 13 | none |
| `shootTheMoon` | Taking every positive card gives their total to everyone else | on | off |
| `target` | When the match ends; null: after the schedule's last deal | 100 | null |
| `bidding` | Optional. A bidding phase before play, the dealer rule and the bid scores | absent | dealer may not match; 10 + 2 a trick met, −2 a trick off |
| `highWins` | Optional. The highest total wins instead of the lowest | absent | on |

House rules are shallow patches on these fields, as in the other families.

- Privacy: `viewTricks` shows a seat only its own hand, the cards it set aside to pass
  and the cards it was passed. Trick cards, cards taken, bids and the card turned up
  for trump are public.
- Bidding goes round from left of the dealer, who bids last. Unless
  `dealerMayMatch`, the dealer may not bid the number that makes the bids add up to
  the tricks in the deal (`blockedBid`; refused with `cardsDealerBid`). Play starts
  left of the dealer once the dealer has bid.
- `upDown` deals 1 card, one more each deal up to `floor(deck / seats)`, then back
  down to 1: 3 seats play 33 deals, 7 seats 13. When the deck deals out exactly
  (4 seats at 13 cards), `turnUp` finds no card and the deal has no trump.
- New state fields (`bids`, `turnedUp`) are optional, so Hartenjagen tables dealt
  before them still read.
- Passing is simultaneous: each seat chooses, and the exchange happens once every seat
  has. "Across" is skipped for an odd number of seats.
- The bot ducks under the winning card, dumps its most dangerous card when it cannot
  follow, and passes its most dangerous cards. It never plays an illegal card.
- In a bidding game the bot bids from its high trumps, aces and guarded kings (the
  nearest allowed number), then wins as cheaply as it can while short of its bid and
  loses with its highest losing card once it has it.

### Extension points for later games

Toepen and Klaverjassen need these; Boerenbridge used the schedule, trump, bidding,
scoring and match-end points. A later game adds a strategy-map entry and names it in
its rules. The rest are new fields with a default that keeps the existing games
unchanged, not a new family.

- **Rank order**: `ranks` already decides strength and the deck. Toepen sets
  `["J","Q","K","A","7","8","9","10"]` and gets its 32-card deck from that.
- **Trump**: `trickWinner` honours `TricksState.trump`, which `trumpChoice` sets per
  deal (Boerenbridge's `turnUp`). Klaverjassen has a seat choose it in a phase of its
  own, and a `trumpRanks` order covers its J 9 A 10 K Q 8 7.
- **Follow rules**: `legalTricksCards` is the single place that decides legal cards,
  so must-trump and must-overtrump are a rule switch read there.
- **Team seating**: a `SEATINGS` entry such as opposite seats as partners. The match
  already ends and is won on team totals. The view still shows totals per seat, so a
  team game adds team totals to `TricksView`.
- **Round schedule**: a `SCHEDULES` entry, from the deck, seat count and round; null
  ends the match. With cards left undealt the `firstLead` card may be in no hand, so
  such a game sets `firstLead` to null.
- **Bidding and stakes**: `bidding` adds a phase before `playing`, after any passing,
  with its own action and refusal codes. Toepen's knocking is a phase of its own.
- **Scoring**: a new entry in `SCORERS` (last trick only, team points plus roem).
- **Trick history**: `taken` keeps each seat's cards, not each trick. Roem is scored
  per trick, so Klaverjassen keeps the tricks themselves for its scorer.
- **Must trump**: a void seat may play anything today. Klaverjassen's must-trump and
  must-overtrump read `seating` too, since a partner already winning lifts them.
- **Match end**: `scoreDeal` ends at `target` or when the schedule has no next deal
  (a fixed number of deals is a schedule that stops), with `highWins` picking the
  winner. Toepen's elimination is still open.

## Acceptance

- `packages/core/src/__tests__/{cards,card-table-view,tricks,boerenbridge}.test.ts` and
  `convex/cardGames.test.ts` pass.
