---
version: 2.1.0
description: Design rules selected by platform and interaction.
---

# Design system

<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [general design](docs/standards/general-design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web design](docs/standards/web-design.md) |
| Native | [Mobile design](docs/standards/mobile-design.md), plus [iOS](docs/standards/ios-design.md) or [Android](docs/standards/android-design.md) |

When the task matches a row, also read:

| Task | Read |
| --- | --- |
| Entering or adjusting a numeric value | [Number fields](docs/standards/number-fields.md) |
| Fullscreen, sheet, or keyboard-anchored editing, or drafts | [Editors](docs/standards/editors.md) |
| Row actions, selection, or section menus in a list | [Actionable lists](docs/standards/lists.md) |
| Creating, reviewing, or building from a design study | [Design studies](docs/standards/design-studies.md) |

Project decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
<!-- appelent-standards:end -->

## Project bindings

The web app's palette lives in `src/styles.css` (`--club-*`). Native UI follows
[the mobile design system](apps/mobile/DESIGN_SYSTEM.md), which transcribes the same palette.

Colour pairs meet WCAG AA in both schemes: text 4.5:1, field and button borders 3:1.
Physical-object palettes (card table, backgammon board) keep their own colours, but their
control borders still reach 3:1 against the brightest felt or stage they sit on: the card
table's `--ivory-line` (`cardColors.ivoryLine`) and the backgammon board's `CONTROL_LINE`.
Decorative lines (panels, rings, empty piles) stay soft.
Change a value in `src/styles.css` and `apps/mobile/src/theme/tokens.ts` together.

| Web | Mobile | Use | Dark | Light |
| --- | --- | --- | --- | --- |
| `--club-soft` | `textFaint` | Faint text, placeholders | `#8794ad` | `#5a687e` |
| `--club-orange` | `orange` (on `orangeDim`) | Backgammon hue, hint text | `#fb923c` | `#ba3e0c` |
| `--club-line` | `border` | Panel and card outlines (decorative) | slate-400 at 18% | slate-900 at 12% |
| `--club-line-strong` | `borderStrong` | Field and button borders | slate-400 at 60% | slate-900 at 50% |

Every field and button border uses `--club-line-strong`; outline buttons and toggles get it
through the `club-btn-outline` utility in `src/styles.css`, not a hand-written border. Inside `.game-fullscreen` the
variable is pinned to its dark value. The site header's translucent dark bar lets the page
through, so its buttons use `border-white/60` (3:1 against the page and against the button's
own `bg-white/10` fill, over both themes) and its links, including "Sign in", use
`.club-nav-link`.

Puzzle board cells (Sudoku, binary) are tap targets, so their thin cell lines use the phone's
`borderStrong` colour, at least 3:1 on the empty board. The board follows the page theme with
its own white or slate-900 ground, even inside `.game-fullscreen`, so it reads `--puzzle-line`
(set on `.puzzle-board` in `src/styles.css`) instead of the pinned `--club-*` variables. The
always-dark scan board reads `--club-line-strong`. Box lines and the outer edge stay heavier:
2px, and `slate-600` in light mode (the phone's `textMuted`); dark mode uses `slate-300/70`
rather than the phone's exact colour. Killer cage outlines use the same colours as box lines,
dashed. The 3:1 holds on empty cells and on peer highlights. A selected, hinted, same-digit or
colour-marked cell shows by its own fill, and the line beside it drops to about 3:1 in light
mode and about 2:1 in dark, the same as on the phone.
