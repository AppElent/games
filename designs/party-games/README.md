# Party games design handoff

Approved design for two new online party games, from [APP-28](https://linear.app/appelent/issue/APP-28):

- **Beat the Clock / Tegen de Klok** (game id `beat-the-clock`): teams, one describer, five words, a timer, opponents referee.
- **Doen, Durven of de Waarheid** (English title: see [open questions](#open-questions)): the active player picks Doen, Durven or Waarheid; everyone sees the prompt.

Eric approved option A on 2026-11-13: the seven design choices below stand as drawn.

| | |
| --- | --- |
| Canvas (rounds, flows, prototype) | [Arcade Club party games](https://claude.ai/artifact/LnbzrJHgP1Etu4RqnLDxF5), version `1794588444-dabe` |
| Design system | [Arcade Club](https://claude.ai/artifact/HuGmGETj8chqaDtXGGqwsw), version `1794327465-b8de` |
| Direction | A, "Scoreboard" (canvas page *Directions*); B and C are on page *History* |

## Studies

Each study has a companion (build from it) and a folder with the final artboards' source copied from the canvas. The `.dc.html` files only render inside the canvas runtime (they load its `support.js`); open the canvas link for the visual and use the files as a record of markup, sizes and colours.

| Study | Companion | Artboards | Canvas page |
| --- | --- | --- | --- |
| Room and join (both games) | [room-and-join_final.md](room-and-join_final.md) | [room-and-join_final/](room-and-join_final/) (5) | Room and join |
| Beat the Clock | [beat-the-clock_final.md](beat-the-clock_final.md) | [beat-the-clock_final/](beat-the-clock_final/) (8) | Beat the Clock |
| Doen, Durven of de Waarheid | [doen-durven_final.md](doen-durven_final.md) | [doen-durven_final/](doen-durven_final/) (5) | Doen, Durven |

To review a state on the canvas: press Play on a phone artboard to click through the flow, and use the artboard's **Tweaks → state** for its other states. Links named "Prototype: …" only skip a wait in the prototype; they are not UI.

## Product decisions

### Approved design choices (2026-11-13)

1. Players pick their own team in the lobby. The host has **Shuffle teams**. Start stays disabled until every team has at least 2 players.
2. The 5 words stay hidden until the describer taps **Go**. When time runs out, the describer can undo a wrong tick, then taps **Send N words to Rockets**.
3. Referees see the ticks live during the turn but can only flag words in the check afterwards. Any opposing player can flag; whoever confirms first ends the check.
4. The timer turns red (`danger`) in the last 5 seconds, together with the label "Last seconds", so colour is never the only signal.
5. Host menu: pause for everyone, skip this turn, how to play, end game (with a confirm step). Player menu: how to play, switch team, leave room.
6. Doen, Durven of de Waarheid ends without a winner. The end screen shows rounds played, prompts done and skipped, and the most-picked category.
7. Buttons are cyan (`accent` / `onAccent`), as the design system says. Existing web rooms use white primary buttons; the new games differ until those rooms are updated (see [leftover work](#leftover-work)).

### Game rules (confirmed 2026-11-10)

1. Beat the Clock ends only after a full round, so every team had the same number of turns. The highest score at or above the target wins; a tie plays one more round.
2. A flagged word doesn't count. No penalty.
3. The referee check confirms itself 10 s after the describer sends.
4. Late joiners: in Beat the Clock they pick a team and play from that team's next turn; in Doen, Durven they join the end of the rotation.
5. Doen, Durven: the active player taps Gedaan or Overslaan; the host can do it for them.
6. A room with the 18+ level can't be joined from the app: the app shows "Open this room in your browser".

### From the agreed intent (APP-28)

- Online rooms in the Bluff Dice shape: every player on their own phone, room code or QR, guests allowed.
- Content packs in Dutch and English. A room's cards or prompts use the host's app language when the room is created; every player's UI chrome follows their own app language.
- The 18+ level is suggestive, never explicit, needs the host's explicit confirmation, and is web only.
- Prompts never repeat within a game; skipping is always allowed.
- Never use the trademarked "30 Seconds" name anywhere, including content and code.

## Shared visual spec

Game screens are always dark, like every Arcade Club game surface (`FullscreenGameShell`). Only the web join page and the new-game page outside the shell follow the app theme; see [light theme](#light-theme-join-page).

### Tokens

Use design system names. Hex values are the dark theme as drawn.

| Use | Design system token | Web (`src/styles.css`) | Mobile (`apps/mobile/src/theme/tokens.ts`) |
| --- | --- | --- | --- |
| Ground | `bg` #080a12 | `--club-bg` | `bg` |
| Card, list, input fill | `surface` #121626 | `--club-panel` / `club-panel` | `surface` |
| Segmented track, notice, nested fill | `surface2` #191f34 | `--club-panel-strong` | `surface2` |
| Card hairline (decorative) | `border` | `--club-line` | `border` |
| Control border (secondary button, input, menu button) | `borderStrong` | `--club-line-strong` | `borderStrong` |
| Text | `text` #f8fafc | `--club-text` | `text` |
| Secondary text, labels, captions | `textMuted` #aab6cc | `--club-muted` | `textMuted` |
| Primary button, selected segment, checkbox, link | `accent` #22d3ee, ink `onAccent` #04121a | `--club-cyan` | `accent`, `onAccent` |
| Selected row, secondary button fill | `accentDim` | none yet: use `accentDim` value | `accentDim` |
| Beat the Clock hue: kicker, timer, ticks, team chips | `amber` #fbbf24 (light #92400e), ink on amber #1c1404 | **add** `--club-amber` | **add** `amber` |
| Beat the Clock fills: ticked word, team chip | `amberDim` | **add** `--club-amber-dim` | **add** `amberDim` |
| Doen, Durven hue: kicker, category, level chip, active ring | `violet` #a78bfa (light #6d28d9) | **add** `--club-violet` | **add** `violet` |
| Doen, Durven fills | `violetDim` | **add** `--club-violet-dim` | **add** `violetDim` |
| Error notice, destructive action, last 5 s of the timer | `danger` #fb7185, fill `dangerDim` | existing error styles | `danger`, `dangerDim` |

Amber and violet were added to the design system artifact for these games; their code tokens land with the first game PR. Contrast is recorded in the design system: amber on `bg` 11.84:1 (dark) and 6.78:1 (light); violet on `bg` 7.26:1 and 6.79:1; each hue on its Dim fill passes 4.5:1 in both themes. Use the token values on `main`, which include the APP-29 contrast fixes, rather than hex values copied from the artboards.

The A-direction artboard (*Directions* page) still shows the Doen, Durven level chip in `#c4b5fd`. The final screens use `violet`; build from those.

### Type

- Titles, timers and scores: Space Grotesk 700 (`club-title`). Body and controls: Manrope.
- Kicker: 11.5–12px, 800, 0.12em tracking, uppercase, in the game hue (`club-kicker` with the hue colour instead of green).
- Screen title 26px (settings, lobby), 34px (waiting, pick), 38px (end screens).
- Describer timer 104px; teammate timer 136px; opponent timer 64px. Tabular numbers on every timer, score and code.
- Prompt text 32px, line height 1.18. A prompt over 120 characters drops to 26px (canvas state `longPrompt`).
- Word rows 21px 700; list rows 16px 600; captions 13–14px.

### Layout and controls

- Phone frame 390 × 844, padding 16px top, 20px sides, 24px bottom. On wider web viewports, centre a column at most 480px wide; game screens never stretch controls across a desktop.
- Header: 44px round icon button (menu or pause, `borderStrong` outline, `surface` fill), then kicker and a meta line, then a right-aligned meta (room code) when there is space.
- Primary button: pill, min-height 52px, `accent` fill, `onAccent` text 16px 800. Secondary: pill, 48px, transparent with a `borderStrong` outline. Quiet action: text button in `accent`, min-height 44px. Every tap target is at least 44 × 44px.
- Pending: the button stays in place, disabled at 45% opacity, with a 16px spinner and an "…ing" label. Never move or remove the control while its request runs.
- Error: `dangerDim` notice with an icon and one sentence above the action, `role="alert"`. The action becomes "Try again" where a retry makes sense.
- Reconnecting: a `surface2` status strip under the header with a 14px spinner, `role="status"`, saying what keeps working.
- Cards and lists: `surface` fill, `border` hairline, radius 18px (`radius-lg`); rows inside radius 12px.
- Segmented controls: `surface2` track, 2px padding, selected segment `accent` with `onAccent` text, each segment `aria-pressed`.
- Bottom sheet (menus): `surface` sheet, radius 24px top, over a `rgba(2, 6, 23, 0.7)` scrim with blur; `role="dialog"`, `aria-modal`, focus moves into the sheet and returns to the menu button on close. A destructive confirm is a separate `alertdialog`.

### Motion

- Spinners rotate at 0.8–0.9 s per turn. Pulse dots (someone is choosing) fade at 1.4 s.
- Under `prefers-reduced-motion: reduce` (web) or Reduce Motion (mobile), replace spinners and pulses with static icons and the text label; the timer still counts.
- No screen transitions beyond the platform default.

### Accessibility

- Timers use `role="timer"` with `aria-live="off"`. A separate polite live region announces "10 seconds left", "5 seconds left" and "Time's up" once each, so screen readers don't read every tick.
- The time bar is a `progressbar` with min 0, max = turn length, now = seconds left.
- Ticks, flags, team cards and segments are toggle buttons with `aria-pressed`; level checkboxes use `role="checkbox"` with `aria-checked` (or native checkboxes).
- A flagged word is shown with strike-through, danger colour **and** the text "Flagged · won't count"; a ticked word with a filled check **and** "Guessed" for opponents. Colour never carries meaning alone.
- Every icon-only button has a translated accessible name (listed in each companion).

### Larger system text

Not drawn; build to this. At 200% text (web) or the largest accessibility size (iOS AX5, Android 200%):

- Screens scroll vertically inside the game shell; nothing is clipped, and the primary action stays reachable at the end of the scroll (not fixed over content).
- Timers scale with the text setting but cap at 1.5× their drawn size, so the countdown still fits one line.
- The two-column scoreboard and team grid become one column below 340px of usable width.
- Word rows grow in height; the word wraps to two lines before it truncates. Never truncate a prompt.
- Header meta (room code, "Turn 7 · first to 30") wraps under the kicker instead of truncating.

### Light theme (join page)

Not drawn; build to this. The web `/join` page and the new-game settings pages sit outside the always-dark game surface and follow the app theme. In light mode use the light value of each token: `bg` #f8fafc, `surface` #ffffff, `text` #0f172a, `textMuted` #475569, `accent` #0e7490 with `onAccent` #ffffff, `danger` #be123c, `amber` #92400e, `violet` #6d28d9, and the Dim fills' light values. Input borders use `--club-line-strong` (3:1 after APP-29). Everything else (layout, copy, states) matches the dark artboards. Once the player is seated, the game screens are dark again.

### Keyboard-open join

Not drawn; build to this, for the join screen (web on a phone, and mobile):

- The code field autofocuses only when the code is empty (state `typed`); a code from a link leaves focus on the name field.
- The code field uses `autocapitalize="characters"`, `autocomplete="off"`, `inputmode="text"`, `enterkeyhint="next"`; the name field `autocomplete="nickname"`, `enterkeyhint="go"`. Enter in the name field submits when both are valid.
- With the keyboard open, the screen scrolls so the focused field **and** the Join button are visible above the keyboard (mobile: `KeyboardAvoidingView` or the screen's keyboard inset; web: `scrollIntoView` with `block: "nearest"` on focus). The room card can scroll off the top.
- The inline error under the code field stays visible while the field has focus.

## Component bindings

Reuse before adding. Shared web pieces live in `src/components/games/`; shared mobile pieces in `apps/mobile/src/ui/` and `apps/mobile/src/features/sessions/`.

| Need | Web | Mobile |
| --- | --- | --- |
| Settings page and create | `NewGamePage` (options as children, create/creating labels, error, `HostGate`) inside `FullscreenGamePage`. Its create button is white today; give it a primary tone option rather than forking the page | `Screen`, `ChoiceList` (packs, levels), `Segmented`, `Button`, `Notice` |
| Room page frame | `SessionBundleRoute` + `FullscreenGameShell`; lobby content can use `RoomFrame` parts (`RoomStartButton`, `RoomLoading`) | `Screen`, `Card` |
| Room code and QR | `JoinCodePanel`, `QrSharePanel` | `QrCode`, share sheet |
| Join | `/join` route, `JoinGamePanel` | `features/sessions/join`, `use-join-session.ts`, `TextField` |
| Seat handling, back in seat | `src/lib/games/seat.ts`, `SeatBanner` | `features/sessions` seat storage |
| Players, kick, rename | `ParticipantList`, `ModerationActions`, `SessionHostControls` | existing participant list |
| Mutations with localized errors | `useGameAction` | existing session hooks |
| End screen | `GameEndScreen` can host Beat the Clock's winner; Doen, Durven needs its stats grid | `Card`, `Button` |
| Menus | `FullscreenGameShell` pause menu, extended with game items | bottom sheet per `expo-ui` guidance |

New per-game pieces: the describer word list, the referee check list, the scoreboard row with progress, the team picker, the category picker and the prompt card. Keep each in the game's folder until a second game needs it.

Copy goes in `packages/core/src/i18n/{en,nl}/games/beatTheClock.ts` and `…/truthOrDare.ts` (one module per game, both languages, `satisfies typeof en`), with catalog entries in `…/catalog.ts`. Placeholders use `fmt`, counts use `plural`.

## Build order

APP-28 plans three PRs: Beat the Clock web, Doen, Durven web, then both on mobile. [ADR 0002](../../docs/adr/0002-ship-every-game-on-web-and-mobile.md) says a new game ships on web and mobile at the same time (an Expo DOM component is allowed to start). So either a web PR keeps its game out of the catalog and `features.ts` until its mobile PR lands, or each game's PR carries both platforms. Settle this when the sub-issues are cut.

## Open questions

- **English title and id for Doen, Durven of de Waarheid.** The copy here uses "Truth or Dare" with categories Do / Dare / Truth, and paths assume the game id `truth-or-dare`. Eric to confirm or rename before the catalog entry ships.
- **Behaviour the canvas didn't show, specified in the companions so no game can get stuck.** Eric can veto any of these without touching the approved screens:
  - Beat the Clock: a describer who doesn't send within 10 s after time runs out sends automatically; after the check confirms, every phone moves to the score after 2 s; **Leave room** asks for confirmation; the host's menu shows **Resume for everyone** while paused; ending the game mid-round with a tie shows "Tied" without an extra round.
  - Doen, Durven: a category with no prompts left is disabled, and the game ends with the summary when all three run out; random order never picks the same player twice in a row; the in-game menu reuses the Beat the Clock sheet with How to play, End game and Leave room.
- **Room code length.** The canvas shows a 4-letter code (`K7QX`). Real codes are 6 characters from `JOIN_CODE_ALPHABET`, shown as `ABC 123` (`formatJoinCode`). Build with real codes; the companions already use them. No design change needed.
- **Team names.** Drawn as fixed names (Comets, Rockets). The companions give a fixed list per language for 2–4 teams; renaming teams is out of scope.
- **Host disconnects.** Not designed. Follow the existing session behaviour (host role stays with the seat; the game waits on the host only for host-only actions).

## References

From Mobbin, used for hierarchy and control placement only (canvas page *Directions*, "A · References"):

- [Nike Training Club](https://mobbin.com/screens/1498c752-f429-456e-9fbb-347f9b70b92d): huge timer digits above a list of items to work through (describer screen).
- [Nibble](https://mobbin.com/screens/96cc8f7b-502f-4de6-b18d-b10d431a37e3): kicker and level above one big statement (prompt screen).
- [Ahead](https://mobbin.com/screens/1f289b25-0dbe-41fe-9472-0b74ac9fd56d): prompt as large plain type, actions anchored at the bottom.

## Leftover work

Not part of this handoff; each belongs to the PR named.

- **`DESIGN_SYSTEM.md` link to the Claude Design system** (first implementation PR, Beat the Clock web). This exact diff was left uncommitted on `main` in the design thread and is preserved here so that PR can apply it:

  ```diff
  --- a/DESIGN_SYSTEM.md
  +++ b/DESIGN_SYSTEM.md
  @@ -30,5 +30,7 @@ Conform, improve, or differ as described in [working with standards](CODING_STAN
   
   ## Project bindings
   
  +Claude Design system: [Arcade Club](https://claude.ai/artifact/HuGmGETj8chqaDtXGGqwsw)
  +
   The web app's palette lives in `src/styles.css` (`--club-*`). Native UI follows
   [the mobile design system](apps/mobile/DESIGN_SYSTEM.md), which transcribes the same palette.
  ```

  It still applies cleanly to `main` at `3742b55` (`git apply --check` passes).
- **`club-amber` and `club-violet`** (with their Dim fills) in `src/styles.css` and `apps/mobile/src/theme/tokens.ts`: first PR of each game.
- **The `generate-game-content` skill's family-friendly rule** needs a documented opt-in exception for the 18+ level: Doen, Durven web PR.
- **White primary buttons in existing web rooms** (Bluff Dice, `NewGamePage`, `RoomStartButton`): a separate design-system alignment issue if Eric wants the rooms to match. Not part of these games.
