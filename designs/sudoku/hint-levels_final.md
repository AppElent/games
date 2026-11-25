# Sudoku hint levels: final study

A maximum hint level and a level badge on each hint ([APP-867](https://linear.app/appelent/issue/APP-867), after the advanced hints of APP-866 / #184).

- Canvas: [Arcade Club — Sudoku](https://claude.ai/artifact/FTvoMxXhkD2xDGHWgtHDzu), page **APP-867 Hint levels** (round 1).
- Artboard source: [hint-levels_final/](hint-levels_final/). `Hints.dc.html` takes the props `screen` (card, higher, settings), `theme`, `lang`, `surface` and `step`. The nine `H867-*` artboards set them.
- Decision: approved by Eric on 2026-11-25 ("Goedgekeurd, bouwen"). He did not pick the alternative, a separate hint settings screen.
- Data model: none. No schema change. The settings stay on the device, next to the input settings.

## Behaviour

- **Setting "Hints go up to"**: Basic, Intermediate or Advanced. The default is Advanced, which matches what the app did before. Expert joins the list with APP-868.
- **"Show the level on each hint"**: on by default. It hides only the badge.
- **Badge**: shows the hint's level, from step 1 on. It is not shown for a mistake, because a mistake is not a technique.
- **Above the maximum**: the engine still finds the simplest step. When that step's level is above the maximum, the card shows the title "Hint" and the badge with the needed level. The text reads "The next step needs {an advanced technique}. Your hints go up to {intermediate}." A **Show it anyway** button turns the card into the normal hint at step 1. The board marks nothing until then. On the phone, the Hint key does the same as Show it anyway.
- Mistakes always come first, whatever the maximum is.
- **Panel**: "Input settings" is renamed **Settings**. It now has a **Hints** section first, then an **Input** section with the existing tap cycle and corner-note controls.

## Look

| Part | Phone | Web |
| --- | --- | --- |
| Badge | pill, 1 px `orange` border, caption text in bold `orange`, `spacing.sm` side padding | `rounded-full border-amber-300/60 text-xs font-bold text-amber-300` |
| Show it anyway | `Button` secondary compact, the same as Tell me more | the same style as Tell me more |
| Level list | `ChoiceList`, with the label and its note | radio rows, each at least 44 px tall, with the note in `text-slate-400` |
| Section headings | caption, uppercase, bold | `text-[11px]` uppercase, bold, `text-slate-400` |

## Copy

| Key | en | nl |
| --- | --- | --- |
| `inputSettings.title` | Settings | Instellingen |
| `inputSettings.hintsUpToLabel` | Hints go up to | Hints gaan tot en met |
| `inputSettings.hintLevels` | Basic / Intermediate / Advanced | Basis / Gemiddeld / Gevorderd |
| `inputSettings.hintLevelNotes` | Singles only / Adds pairs, triples and pointing / Adds X-Wing, Swordfish, wings and unique rectangles | Alleen singles / Ook paren, drietallen en wijzend / Ook X-Wing, Swordfish, wings en unieke rechthoek |
| `inputSettings.showHintLevel` | Show the level on each hint | Toon het niveau bij elke hint |
| `game.hintAboveMax` | The next step needs {needed}. Your hints go up to {max}. | Voor de volgende stap is {needed} nodig. Je hints gaan tot en met {max}. |
| `game.showHintAnyway` | Show it anyway | Toch tonen |

## States

| State | Artboard |
| --- | --- |
| Badge on the hint card, phone dark / light nl / web | `H867-Card-*` |
| Next step above the maximum | `H867-Higher-*` |
| Settings panel with the Hints section | `H867-Settings-*` |
| Badge off | Untick the box on any `Settings` artboard, then open a card |
