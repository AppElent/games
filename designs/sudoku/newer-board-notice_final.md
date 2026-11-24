# Sudoku newer-board notice: final study

A notice that tells the player why their Sudoku or Binary board just changed: a newer board, saved on another device, replaced the one on this screen ([APP-791](https://linear.app/appelent/issue/APP-791), follow-up of APP-765 / #172).

- Canvas: [Arcade Club — Sudoku](https://claude.ai/artifact/FTvoMxXhkD2xDGHWgtHDzu), page **APP-791 Newer board notice** (round 1, version `1795548225-ed92`)
- Artboard source: [newer-board-notice_final/](newer-board-notice_final/). `Main.dc.html` takes the props `option`, `theme`, `lang`, `surface` and `lost`; the four `A-*` artboards set them.
- Decision: option **A, inline notice above the board**, chosen by Eric on 2026-11-24. Rejected on the same page: B (a toast over the keypad: it covers the controls, and an auto-hide fails timing for screen-reader users) and C (a dialog that pauses play: too heavy for an event with no choice to make).
- Data model: none. No schema change.

## When it shows

| Surface | Trigger | `lost` (second sentence) |
| --- | --- | --- |
| Web | `useSoloPuzzleSession` calls `onStale` and `SoloPuzzle` remounts the board from the stored puzzle | Always: a save from this board was refused, so its last moves are gone |
| Phone | `use-opened-save.ts` `follow()` swaps the open save for the one the sync stored (`loadedUpdatedAt` changed) | Only when the replaced copy held unsent changes (`hasUnsentChanges` on the copy before the swap). A board that only moved forward from the account shows the notice without the second sentence |

Not shown:

- On first open of a puzzle, even when the account's copy is newer than the phone's (that is normal loading, not a replacement under the player's hands).
- When the board was solved meanwhile: `complete` decides, and the solved banner shows instead.
- Twice for one replacement. A second replacement while the notice is up keeps one notice; `lost` becomes true if either replacement dropped moves.

## Behaviour

- Sits between the status row and the board (phone: under `PuzzleStatus` in `PuzzleFrame`; web: under `PuzzleHeader`, where `CompletedBanner` goes).
- Stays until the player taps **OK** or makes their next move on the board (a digit, note, colour or erase). Pause and resume do not dismiss it.
- It pushes the board down by its own height. That is accepted: the board's content just changed anyway, and nothing moves while the player is mid-tap.
- Leaving the screen dismisses it; it is not stored.
- No haptic.
- Screen readers: announced politely once when it appears (native `accessibilityLiveRegion="polite"` and `accessibilityRole="text"`, as `Notice` info does; web `role="status"`). The OK button is a real button with its visible label.

## Look

| Part | Phone (`apps/mobile`) | Web (game surface, dark in both themes) |
| --- | --- | --- |
| Container | `accentDim` fill, `radius.md` (12), padding `spacing.md` × `spacing.lg`, no border: the info `Notice` look | `rounded-lg`, `border border-cyan-400/50`, `bg-cyan-500/15`, `px-4 py-3`: `CompletedBanner` with cyan instead of emerald |
| Icon | `Icon` "arrow.triangle.2.circlepath" / Material "sync", `accent`, 20, decorative | lucide `RefreshCw` `h-5 w-5 text-cyan-300`, `aria-hidden` |
| Title | `AppText` `label` weight, `text` | `font-bold text-cyan-100` |
| Body | `AppText` `secondary`, tone `default` (`text`, as `Notice` uses) | `text-sm text-cyan-100` |
| OK | `Button` `plain`, at least 44 × 44, `accent` | text button, `font-bold text-cyan-300 hover:text-white`, min 44 × 44 |

`Notice` today takes only a message. Extend it with optional `title` and `action` (`{ label, onPress }`), keeping today's one-line use unchanged, rather than a Sudoku-only component.

## Copy

Suggested keys in `packages/core/src/i18n/{en,nl}/games/sudoku.ts`, under `game`:

| Key | en | nl |
| --- | --- | --- |
| `game.replacedTitle` | Board updated | Bord bijgewerkt |
| `game.replacedBody` | You played on another device, so this board now shows where you left off there. | Je speelde op een ander apparaat, dus dit bord toont nu waar je daar was gebleven. |
| `game.replacedLost` | Moves you made here since then were not kept. | Zetten die je hier sindsdien deed, zijn niet bewaard. |
| `game.replacedDismiss` | OK | Oké |

The body and `replacedLost` render as one paragraph, separated by a space.

## States

| State | Artboard |
| --- | --- |
| Phone dark, en, moves dropped | `A-Dark` |
| Phone light, en, moves dropped | `A-Light` |
| Phone light, nl, moves dropped (longest copy) | `A-Light-NL` |
| Web 390, en, moves dropped | `A-Web` |
| No moves dropped | `Main` with `lost` off |
| Dismissed | Tap OK or any key on any artboard |

Larger text: the notice grows in height and wraps; the board keeps its size and the screen scrolls (the `PuzzleFrame` ScrollView already does). Binary uses the same notice in the same place.

## Tests to add

- Web: extend `src/components/sudoku/__tests__/stale-save.test.tsx`: after a refused save the notice shows with the lost sentence; OK hides it; the next digit hides it; a solved board shows no notice.
- Phone: extend `sudoku-play-screen.test.tsx`: a sync replacement with unsent changes shows title, body and lost sentence; one without unsent changes shows no lost sentence; first open shows nothing; the next move dismisses it.

## Open questions for the build

- The phone must know whether the replaced copy had unsent changes at the moment of the swap. Read it before `storeSyncedSave` overwrites the copy (sync) or pass it along with the write-change event; the builder picks the smallest change.
