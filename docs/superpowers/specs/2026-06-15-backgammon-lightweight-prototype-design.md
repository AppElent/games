# Backgammon Lightweight Prototype Design

## Goal

Build the next Backgammon slice for Arcade Club: a live, two-player, tap-to-move prototype that syncs board state across devices while deliberately postponing full Backgammon rules enforcement.

## Scope

This phase turns the current Backgammon challenge waiting room into a lightweight playable board. It includes app-rolled dice, active turns, tap source then destination movement, board state syncing, and a structured move log.

This phase does not implement full rules correctness. Hitting, blocked points, bearing-off legality, forced moves, doubles expansion, move-distance validation, resigning, match scoring, doubling cube, and automated win detection are reserved for the rules-correct phase.

## Architecture

The existing shared session tables remain generic:

- `gameSessions`
- `sessionParticipants`

Backgammon-specific storage must be clearly prefixed:

- `backgammonGameStates`: one live board snapshot per Backgammon session.
- `backgammonMoves`: structured roll, move, and turn log entries.

The existing `backgammonStates` table and `convex/backgammon.ts` functions will be migrated to the prefixed naming in this slice. Because this is early development data, no compatibility migration for old dev rows is required.

## Data Model

`backgammonGameStates` stores:

- `sessionId`
- `phase`: `waiting`, `ready`, `active`, or `finished`
- `whiteParticipantId`
- `blackParticipantId`
- `activeColor`: `white` or `black`
- `points`: 24 board points, each with `color` and `count`
- `bar`: white and black checker counts on the bar
- `off`: white and black checker counts borne off
- `dice`: current rolled dice values
- `usedDice`: dice values already consumed in the current turn
- `winnerParticipantId`
- `createdAt`
- `updatedAt`

`backgammonMoves` stores:

- `sessionId`
- `participantId`
- `moveType`: `roll`, `move`, or `endTurn`
- `color`
- `from`: board point number, `bar`, or `off`
- `to`: board point number or `off`
- `dice`: dice values relevant to the log entry
- `createdAt`

Board points use 1-based point numbers for game concepts in UI and logs. Internal arrays may be 0-based, but helpers must convert explicitly at boundaries.

## Interaction Design

Backgammon uses tap source, tap destination.

On a player's turn:

1. The active player presses Roll.
2. Convex stores two random dice on `backgammonGameStates`.
3. The player taps a source point containing their checker.
4. The player taps a destination point.
5. Convex applies a prototype move and records a `backgammonMoves` row.
6. The player can end the turn manually, which clears dice and switches `activeColor`.

The UI shows:

- White and black seat cards.
- Active turn indicator.
- Dice chips.
- Roll button only for the active seated player before dice are rolled.
- End turn button after dice are rolled.
- A 24-point board with selectable points.
- Bar and off counters as simple side targets.
- Move log in the side panel.

## Prototype Move Rules

The prototype enforces only basic safety checks:

- Session must be a Backgammon session.
- Both seats must exist before play starts.
- Only the active seated participant can roll, move, or end turn.
- Dice must be rolled before moving.
- Source point must contain at least one checker of the active color.
- Destination must be a board point or `off`.
- Moving from a point decrements that source.
- Moving to a board point increments that destination for the active color.
- Moving to `off` increments the active color's off count.

The prototype intentionally does not validate whether the destination matches a die value, whether a point is blocked, whether a checker can bear off, or whether all dice have been used.

## Components

`src/lib/games/backgammon.ts` contains pure helpers:

- initial board creation
- point-number conversion
- prototype move application
- active color switching
- dice value generation and normalization

`convex/backgammon.ts` contains backend session actions:

- create initial state
- get live bundle
- roll dice
- apply prototype move
- end turn

`src/components/backgammon/BackgammonBoard.tsx` renders the interactive board.

`src/components/backgammon/BackgammonControls.tsx` renders turn and dice controls.

`src/components/backgammon/BackgammonMoveLog.tsx` renders structured move history.

`src/components/backgammon/BackgammonWaitingRoom.tsx` becomes the full Backgammon session view and switches between waiting/ready/play states.

## Error Handling

Backend mutations throw user-facing errors for invalid actions:

- `Backgammon game not found`
- `Waiting for both players`
- `It is not your turn`
- `Roll before moving`
- `Choose a point with your checker`
- `Invalid destination`

The UI shows these as compact inline messages near the board controls. Invalid local selections can be cleared without calling the backend when the selected point clearly cannot be used.

## Testing

Pure helper tests cover:

- initial board has 24 points and 15 checkers per color
- rolling returns two dice in the 1-6 range
- applying a prototype move updates source and destination
- moving off increments the correct off counter
- moving from an empty point is rejected
- active color switches on end turn

Convex verification uses `npx convex dev --once` to verify schema and function generation.

App verification uses:

- `npm run check`
- `npm test`
- `npm run build`

## Follow-Up Phase

The rules-correct phase will replace permissive prototype move validation with a proper rules engine or a carefully tested local rules module. That phase will validate legal moves, blocked points, hits, bar entry, bearing off, doubles, forced moves, win detection, and replay from `backgammonMoves`.

## Self-Review

- Placeholder scan: no TBD, TODO, or unresolved placeholders.
- Scope check: focused on Backgammon prototype play only.
- Naming consistency: all game-specific new tables and files use `backgammon` prefixes.
- Ambiguity check: rules not enforced in this prototype are explicitly listed and deferred.
