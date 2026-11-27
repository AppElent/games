# Backgammon drag and haptics: final study

Drag-and-drop, drop-target highlighting, illegal-move feedback and haptics for the backgammon board ([APP-964](https://linear.app/appelent/issue/APP-964)), from Sentry user feedback ARCADECLUB-D (iPhone): "When playing backgammon, I want to drag the items. It should feel good as well using haptics."

- Canvas: [Arcade Club — Backgammon](https://claude.ai/artifact/LbpWV94KNKdJv2vL75HjS3), page **APP-964 Drag & haptics** (round 1, version `1795782918-794d`). `Main.dc.html` there is a playable prototype.
- Artboard source: [drag-haptics_final/](drag-haptics_final/). `Board.dc.html` takes the props `scene` (idle, lifted, hover, illegal, hit, bearoff, live), `width`, `direction`, `pointer`, `lang` and `theme`; `Phone.dc.html` and `Web.dc.html` wrap it; the `P-*` and `Web-*` artboards set the props. `Spec.dc.html` summarises this file.
- Decision: variant **A, the lifted checker rides above the finger**, chosen by Eric on 2026-11-27. Rejected: B (the checker stays under the finger). At about 23 pt a checker disappears under a fingertip and so does the point it is over.
- Data model: none. No schema change.

## Scope

- Phone (Expo): add drag-and-drop to the board, drop-target highlighting, illegal-drop feedback and a haptic pattern. Today the phone is tap-only (`board/use-board-selection.ts`).
- Web: the board already drags (`src/components/backgammon/BackgammonBoard.tsx`, pointer events, plain ghost, silent no-op on an illegal drop). It gets the same lifted checker, hover state, landing ghost, spring-back and rejection sentence. No haptics on the web.
- Tap-to-move stays on both platforms, unchanged, and stays the screen-reader path (design system: "Nothing requires drag").
- No rules, schema or Convex change. Moves still go through `planBackgammonMove` / `getMoveHighlights` from `@arcadeclub/core/backgammon`.

## Gesture (both platforms)

1. **Press** one of your own checkers: the top of a stack, or the bar when a checker must enter. No long press.
2. **Lift** once the pointer has moved 6 pt (the web already uses 6 px). The checker scales to 1.3×, gets a drop shadow and a 3 pt `selected`-orange ring. The source stack draws one fewer checker and its column gets the `selected` ring. Legal destinations light up (existing `target` / `targetFill`).
3. **Carry**. Phone and web touch: the checker rides 1.7 checker heights above the finger (variant A), so the finger never hides it or the point it is over. Web mouse: the checker sits under the cursor, cursor `grabbing`.
4. **Hover**. The target is the column (or bar, or tray) under the lifted checker's centre, not under the finger. Whole half-column is the hit area. A legal target becomes "hovered": fill `rgba(120,220,170,0.45)`, 3 pt ring `#8ff0c0`, glow, plus a ghost checker (dashed outline, 35% fill) in the slot where the checker will land (slot 0 when it will hit a blot; a ghost slab in the tray for bear-off). Illegal points never light.
5. **Release on a hovered target**: commit the plan the target maps to (single or combined), the checker settles with a spring (~180 ms). A hit slides the blot to the bar (220 ms). Tray = bear off.
6. **Release on an illegal point** (board, bar or tray that is not lit): the checker springs back to its stack (220 ms, ease-out `cubic-bezier(.2,.8,.2,1)`) and the status line shows the rejection sentence.
7. **Release on its own point or off the board**: spring back quietly. A cancel, not a mistake: no haptic, no sentence.

Edge rules:

- Combined moves (both dice, "Combine two dice" on) light and drop like single ones; the settle animates via the intermediate point.
- Reduced motion: no flights, spring or slide; checkers place at once. Haptics stay.
- Online: an opponent move or a state change arriving mid-drag cancels the drag and returns the checker (no haptic). While not your turn, a press does nothing.
- The board never scrolls while a checker is lifted (phone: the gesture owns the touch; web: `touch-action: none`, already set).
- A tap selection (existing) and a drag never mix: starting a drag clears a tap selection.

## Haptics (phone, `apps/mobile/src/feedback/haptics.ts`)

| Moment | expo-haptics | Name |
| --- | --- | --- |
| Tap to select or deselect | `selectionAsync()` | `selectionChanged` (exists) |
| Lift (drag starts) | `impactAsync(Light)` | `checkerLifted` (new) |
| Enter a legal point while dragging | `selectionAsync()` | `targetEntered` (new) |
| Drop: move or bear off | `impactAsync(Medium)` | `moveMade` (exists) |
| Drop: hits a blot | `impactAsync(Heavy)` | `checkerHit` (new, replaces `moveMade`) |
| Last checker off (win) | `notificationAsync(Success)` | `gameWon` (exists, replaces both) |
| Drop on an illegal point | `notificationAsync(Warning)` | `moveRejected` (exists) |
| Drop on own point or off board | none | — |
| Opponent moves (online) | none | — |

One haptic per moment, never two in a row. `targetEntered` fires once when entering a legal target, never on leaving one or on moving within it. iOS "System Haptics" off silences everything; no in-app switch.

## Copy

| Key (`games.backgammon.board`) | EN | NL |
| --- | --- | --- |
| `hintPickChecker` (phone, changed) | Drag or tap a checker to move. | Sleep of tik op een schijf om te zetten. |
| `hintPickTarget` (phone, changed) | Drop on a lit point, or tap one. | Laat los op een verlicht punt, of tik erop. |
| `moveRejectedReach` (new, both) | You can't move there with {dice}. | Daar kun je niet heen met {dice}. |
| `moveRejectedBlocked` (new, both) | Point {number} is blocked. | Punt {number} is geblokkeerd. |

`{dice}` is the remaining dice joined with "and" / "en" ("5 and 3", "5 en 3"). The rejection sentence replaces the hint in the status line, is announced (live region / `accessibilityLiveRegion`), and stays until the next press. Web keeps `dragHint`. "Blocked" when the point holds two or more opposing checkers, otherwise "can't move there".

## Tokens

- Existing: `backgammonColors.selected`, `.target`, `.targetFill` (mobile `theme/tokens.ts`), same values on the web board.
- New: `targetHover` fill `rgba(120,220,170,0.45)`, `targetHoverRing` `#8ff0c0`, landing ghost `rgba(255,253,246,0.35)` with a 2 pt dashed `#fffdf6` edge. The board palette stays the same in light and dark (physical object).
- Lifted checker shadow `0 10px 18px rgba(0,0,0,0.5)`.

## Implementation notes

- Phone: `react-native-gesture-handler` (~3.3) `Gesture.Pan()` with `minDistance(6)` on the board, `react-native-reanimated` (4.7) shared values for the lifted checker's position and scale; hit-test with `board-layout.ts` geometry (`columnX`, `barX`, `trayX`, `bottomY`). Haptics via the named functions above, called on the JS thread (`runOnJS`) at state transitions only. Keep `Pressable` columns for taps and VoiceOver.
- Web: keep the pointer-event drag; replace the plain ghost with the real checker at 1.3×, add `hoverTarget` state, the landing ghost, the spring-back (CSS transition to the source slot) and the rejection sentence in the status line. Touch pointers get the phone's 1.7× offset.

## Coverage on the canvas

Phone: lifted, over a legal point, illegal drop springing back, hit, bear-off (EN dark); lifted, hover, illegal, hit (NL light). Variant B stays on the canvas only. Web 1280: hover (EN dark), illegal (NL; the game surface is dark in both themes). A playable prototype (phone NL dark) with real rules for one position and a haptic indicator.

## Open questions for the build

- Settle spring constants and the lift offset feel best tuned on a device; 1.7 checker heights is the starting value.
- Android: same expo-haptics calls; confirm the Light impact is noticeable on mid-range devices (Android work is paused).
