---
type: contract
description: Read when changing card games (Pesten, Mau-Mau, Jokeren, Eenentwintigen, Hartenjagen, Klaverjassen, Gin Rummy, Boerenbridge), the card engine, its stored state, seat claims or card art.
version: 1.5.0
status: current
---

# Card games

Card games add new games as rule configuration, with no backend or UI code, and look
and behave the same on web and mobile. Before changing the engine, its stored state or
seat claims, read [the decision](../adr/0001-card-games-use-rule-families-and-config.md).

## Behavior

- One catalog entry (`card-games`) leads to a hub at `/cards` listing every game in
  `CARD_GAMES` (Pesten, Mau-Mau, Jokeren, Eenentwintigen, Hartenjagen, Klaverjassen,
  Gin Rummy, Boerenbridge).
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
  each other, such as match lengths or Boerenbridge's only up and only down;
  `toggleHouseRule` keeps the setup screens to one, and the server refuses two.
- In the `bank` family every seat plays its own hand against a computer bank that is
  part of the game state, not a seat. Players pick a stake from a fixed set of points
  each round, and the bank's face-down card stays hidden until the bank plays. Text
  speaks of points only, never money or betting.
- A table is created in one step by `cardGames.createTable`, and joiners claim a seat
  through `ON_JOIN` (`convex/lib/tableSeats.ts`). A seat is proven by a secret the
  device keeps, since participant ids are public.
- Web (`src/components/cards`) and mobile (`apps/mobile/src/features/cards`) draw the
  same card art from `packages/core/src/cards/art.ts` and derive the same table logic
  (names, hints, fresh cards, flights) from `packages/core/src/cards/table-view.ts`.

## Trick-taking (`tricks`)

`packages/core/src/cards/tricks.ts` deals the hands, optionally has a seat call trump,
passes cards or takes bids, then plays tricks: the first card sets the suit, others
must follow it if they can, and the highest card of that suit (or the highest trump)
takes the trick and leads the next. When the hands are empty the deal is scored; the
match ends after the deal in which someone reaches `target`, after `deals` deals, or
after the schedule's last deal.

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

Klaverjassen adds these optional fields; leaving one out keeps Hartenjagen's behaviour:

| Field | What it decides | Klaverjassen |
| --- | --- | --- |
| `trumpRanks` | Rank order inside the trump suit, low to high | J 9 A 10 K Q 8 7 (high to low) |
| `callTrump` | Seats call trump in a `trump` phase before passing, bidding and play; `trumpChoice` picks the suit put to them (`random`), or `none` has the first seat name it | on, `random` |
| `mustTrump` | A void seat must trump and overtrump (`always`, Rotterdams), or, when void, not while its partner holds the trick (`unlessPartnerWins`, Amsterdams). Going higher when trumps are led holds under both, and undertrumping is refused while another card can be played | `always` |
| `rankPoints`, `trumpPoints` | Points per rank outside and inside trump, for the `pointsAndRoem` scorer | A 11, 10 10, K 4, Q 3, J 2; trump J 20, 9 14 |
| `lastTrickBonus` | Points for taking the last trick | 10 |
| `roem` | Each trick's roem (`roem.ts`) goes to its taker | on |
| `pitBonus` | Roem for a team taking every trick | 100 |
| `deals` | The match ends after this many deals, for a schedule that never runs out | 16 (with `target` null and `highWins` on) |

The `pointsAndRoem` scorer counts per team: the team that called trump (`maker`) must
score more than half of all points and roem, or it goes nat and the other team scores
everything. With `seating: "opposite"` every seat carries its team's score, so team
totals are any member's total. The view adds `teams`, `offered`, `trumpPassed`,
`maker`, `roem` and `lastDeal` (the last deal per team) for the team strip, trump call
and deal summary.

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
- The bot picks its card through `CARD_CHOOSERS`, keyed by `scoring`. For penalty cards
  it ducks under the winning card, dumps its most dangerous card when it cannot follow,
  and passes its most dangerous cards. For points and roem it calls trump on a strong
  hand, draws trumps with the top trump, feeds points to a partner holding the trick
  and wins cheaply. It never plays an illegal card.
- In a bidding game the bot bids from its high trumps, aces and guarded kings (the
  nearest allowed number), then wins as cheaply as it can while short of its bid and
  loses with its highest losing card once it has it.
- A trump call is two actions, `passTrump` and `chooseTrump`; refusals are
  `cardsNotCallingTrump`, `cardsCallTrumpFirst`, `cardsMustChooseTrump` and
  `cardsTrumpNotOffered`. Follow refusals add `cardsMustTrump`, `cardsMustOvertrump` and
  `cardsNoUndertrump`.

### Extension points for later games

Toepen needs these; Boerenbridge used the schedule, trump, bidding, scoring and
match-end points, and Klaverjassen added rank order in trump, the trump call,
must-trump, team seating, roem, its scorer and the deal-count match end. The strategy
maps (`SCHEDULES`, `TRUMPS`, `SEATINGS`, `SCORERS`, `CARD_CHOOSERS`) hold only what the
current games use; a later game adds an entry and names it in its rules. The rest are
new fields with a default that keeps the existing games unchanged, not a new family.

- **Rank order**: `ranks` already decides strength and the deck. Toepen sets
  `["J","Q","K","A","7","8","9","10"]` and gets its 32-card deck from that.
- **Trump**: `trickWinner` honours `TricksState.trump` and `trumpRanks`. `TRUMPS`
  entries take the undealt cards and the deal's random source and return the suit and
  any card turned up for it (Boerenbridge's `turnUp`, Klaverjassen's `random` offer).
- **Follow rules**: `legalTricksCards` is the single place that decides legal cards;
  `mustTrump` is read there.
- **Team seating**: `SEATINGS.opposite`; the tables show a team strip and team rows
  whenever `teams` has partners (`isTeamGame`).
- **Round schedule**: a `SCHEDULES` entry, from the deck, seat count and round; null
  ends the match. With cards left undealt the `firstLead` card may be in no hand, so
  such a game sets `firstLead` to null.
- **Bidding and stakes**: `bidding` adds a phase before `playing`, after any trump call
  and passing, with its own action and refusal codes. Toepen's knocking is a phase of
  its own.
- **Scoring**: a new entry in `SCORERS` (last trick only).
- **Match end**: `scoreDeal` ends at `target`, after `deals`, or when the schedule has
  no next deal, with `highWins` picking the winner. Toepen's elimination is a further
  match-end rule.

## Acceptance

- `packages/core/src/__tests__/{cards,cards-bank,card-table-view,tricks,boerenbridge,klaverjassen}.test.ts` and
  `convex/cardGames.test.ts` pass.
