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
Change a value in `src/styles.css` and `apps/mobile/src/theme/tokens.ts` together.

| Web | Mobile | Use | Dark | Light |
| --- | --- | --- | --- | --- |
| `--club-soft` | `textFaint` | Faint text, placeholders | `#7c8aa3` | `#5f6e84` |
| `--club-orange` | `orange` (on `orangeDim`) | Backgammon hue, hint text | `#fb923c` | `#ba3e0c` |
| `--club-line` | `border` | Panel and card outlines (decorative) | slate-400 at 18% | slate-900 at 12% |
| `--club-line-strong` | `borderStrong` | Field and button borders | slate-400 at 60% | slate-900 at 50% |

Every field and button border uses `--club-line-strong`. Inside `.game-fullscreen` the
variable is pinned to its dark value. The site header and the dark-styled controls
(`club-input-dark`, `club-btn-secondary` and their near-variants) spell that dark value as
`border-slate-400/60`; they are built for dark surfaces and do not adapt to light mode.
