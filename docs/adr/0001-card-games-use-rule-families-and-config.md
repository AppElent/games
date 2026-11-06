---
type: decision
description: Read before adding a card game or changing the card engine, its state storage, or seat claims.
version: 1.0.0
status: accepted
date: 2026-11-05
---

# Build card games from rule families and per-game config

Arcade Club needs many card games, and each one is mostly variations on a few
structures. Pesten and Jokeren are the first two. Card games also keep hands
hidden, which the shared session model does not protect, because participant ids
are public. Game states saved for live tables make the storage shape hard to change.

Each game is a data definition in `packages/core/src/cards/games/` for a rule
family (`shedding`, `rummy`). A family is a pure module with its rules, view
filter and bot. All games share one catalog entry (`card-games`), one Convex
module and one table, `cardGameStates`, whose `game` column is `v.any()` and
only ever written by the engine. Computer players run on the server through
scheduled, version-checked jobs. Participant ids are public, so a seat is held
by a secret the client generates, which every move and private read must
present. The secret is claimed in the mutation that creates the host or joiner,
which leaves no moment for someone else to claim that seat first.

## Consequences

- A new game in an existing family is a config file, a `CARD_GAMES` entry and
  messages in both locales, with no backend or UI code.
- A game outside the families, such as trick-taking, needs a new family module
  and table component, but no new tables or Convex functions.
- Convex cannot validate the shape of `game`. Engine changes must stay readable
  for tables already in progress, or those tables must be ended.
- Losing the browser's local storage loses a guest's seat. Signed-in players
  reclaim theirs through their account.
- Solo play uses the same server path as multiplayer, so offline play is not available.

## Rejected

- A fully declarative rules language: turn order, melding and scoring differ
  enough that the language would become a worse programming language.
- One table per family: more schema and more Convex code for each family, with no
  gain, because the engine already owns validation.
- A separate local driver for solo games: a second way to run every rule and bot,
  which would have to be kept identical to the server.
- Trusting participant ids for seats: anyone watching a session could read a hand
  or play for another player.
