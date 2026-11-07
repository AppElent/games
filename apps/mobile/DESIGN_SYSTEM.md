# Arcade Club mobile design system

## Identity

Arcade Club is a phone-first party and puzzle arcade: quick to start, readable at
arm's length, and calm while a game is in progress. Dark is the brand default. Light
mirrors the web app's `.light` palette. Cyan `accent` marks primary actions,
selection and focus. Each game has one hue for its tile and highlights (Sudoku
cyan, Backgammon orange, Hitster pink).

`src/theme/tokens.ts` owns every colour, the spacing and radius scales,
`metrics` (44-point hit target, 50-point controls, 640-point content width) and
the type ramp. Nothing else spells a hex value or a `fontSize`. Text renders
through `AppText` variants.

## Components

| Primitive (`src/ui/`) | Use |
| --- | --- |
| `Screen` | Scrolling screen with gutters and content max width |
| `Card` | One object or summary; pressable when it navigates |
| `Button` | `primary` (one per view), `secondary`, `plain` text action, `danger` |
| `Segmented` | Small fixed choice sets (difficulty, target, timer) |
| `ChoiceList` | Radio list where each option needs a detail line (Hitster mode, pack) |
| `TextField` | Labelled text entry |
| `Notice` | Inline `info` or `error` message |
| `CenteredState` | Loading, empty and not-found states |
| `Icon` | SF Symbol on iOS, Material Symbol on Android |

Feature-owned game surfaces:

- Backgammon board (`src/features/backgammon/board/`): SVG art with one
  pressable column per point, tap-to-move with highlighted targets. The board
  palette is `backgammonColors`: a physical wooden board in both schemes. The
  board always shows the viewer's colour at the bottom.
- Hitster timeline (`src/features/hitster/room/timeline-list.tsx`): a
  vertical list, oldest at the top, with dashed "Place here" slots between
  cards. Placement is tap-only, so it works without drag and with a screen
  reader.
- Card table (`src/features/cards/table/`): a felt in the game's own colour,
  with the opponents along the top and your hand along the bottom. The card
  art is data from `@arcadeclub/core/cards/art`, shared with the web. Everything
  is tap-only: tap a card to play or select it, tap a lit pile or meld to act on
  it. Cards cross the table in an overlay, unless motion is reduced.

## Interaction rules

- Haptics go through `src/feedback/haptics.ts` and are named by meaning
  (`moveMade`, `moveRejected`, `gameWon`).
- Destructive resets (new backgammon game, restart puzzle) confirm first.
- A Hitster room and a card table keep the screen awake for their lifetime.
- Online screens show a localized generic notice when a mutation fails. They
  never show raw server text.
- Text scales with the system setting everywhere except fixed board geometry
  (see the [coding standards](CODING_STANDARDS.md#project-decisions)).

## Exceptions

| Rule | Scope | Replacement | Reason |
| --- | --- | --- | --- |
| Colours come from semantic tokens per scheme | Backgammon board | `backgammonColors`, the same in light and dark | A board reads as a physical object, and checker colours are game state. |
| Colours come from semantic tokens per scheme | Card table | `cardColors`, the same in light and dark | Felt and playing cards read as physical objects. |
| Text scales without a cap | Card table | Scales up to 1.3× (`TABLE_TEXT_SCALE`) | Seats, piles and hand share one fixed screen, and the rules and lobby carry the same words at full size. |
| 44pt hit targets | Overlapping cards in a big hand | At least 23pt wide and a full card tall | Thirteen cards stay visible at once. VoiceOver reaches each card as its own button. |
| Single accent | Game tiles | Per-game hue (`accent`, `orange`, `pink` with `*Dim` fills) | Helps players tell games apart in the list and in Continue. |
