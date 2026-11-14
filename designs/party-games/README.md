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

### Leaving a room

Both games, all clients. There is no leave mutation today (only the host's kick, `kickedAt`), so each game adds one (suggested `beatTheClock.leave` / `truthOrDare.leave`, using `useGameAction` / `useSessionAction` with the overview's pending and error states):

- **Server.** Leaving sets `leftAt` on the participant and clears its team (Beat the Clock) or rotation slot (Doen, Durven). Left rows don't count for the ready rule, turns or the too-few checks. The host has no Leave room (they use End game).
- **Where the leaver lands.** Web: the home page (`/`). Mobile: the Play tab. The local seat for that session is forgotten.
- **Preview and `alreadyIn`.** `invitePreview` skips left rows, as it skips kicked ones, so a leaver sees the normal join form, not "Your seat is still yours".
- **Rejoin.** `admitParticipant` already reclaims the same identity's row; for a left row it clears `leftAt` and the player comes back as a late joiner (Beat the Clock: pick a team, play from that team's next turn; Doen, Durven: end of the rotation). Old team, score credit and rotation slot are not restored.
- **Leaving mid-turn, Beat the Clock.** The describer leaves during `ready`: the next describer on that team gets the ready screen (same turn). During `describing` or `timeUp`: the ticks as they stand are sent, as the auto-send does, and the check runs. A referee or teammate leaving changes nothing in the turn.
- **Leaving mid-turn, Doen, Durven.** The active player leaves while choosing or on the prompt: the turn counts as skipped and the next player is up.
- **Too few players** after a leave follows each game's rule (Beat the Clock: short teams are skipped, fewer than 2 playable teams ends the game; Doen, Durven: fewer than 2 players ends the game).

## Shared visual spec

**Web:** game screens, including the settings pages and lobbies, are always dark: they render inside `FullscreenGamePage` / `FullscreenGameShell`, whose `.game-fullscreen` class pins the dark tokens (`src/styles.css`). Only the `/join` page (`src/routes/join.tsx`, normal app chrome) follows the app theme.

**Mobile:** every screen follows the app theme (`lightColors` / `darkColors` in `apps/mobile/src/theme/tokens.ts`, read through `useThemedStyles`); nothing pins dark. Build each screen with tokens only, so light mode is the dark artboard with each token's light value. See [light theme](#light-theme).

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
| Primary button, selected segment, checkbox, link | `accent` #22d3ee, ink `onAccent` #04121a (light #ffffff) | `--club-cyan`; **add** `--club-on-cyan` for the ink | `accent`, `onAccent` |
| Selected row, secondary button fill | `accentDim` | none yet: use `accentDim` value | `accentDim` |
| Beat the Clock hue: kicker, timer, ticks, team chips | `amber` #fbbf24 (light #92400e), ink `onAmber` #1c1404 (light #ffffff) | **add** `--club-amber`, `--club-on-amber` | **add** `amber`, `onAmber` |
| Beat the Clock fills: ticked word, team chip | `amberDim` | **add** `--club-amber-dim` | **add** `amberDim` |
| Doen, Durven hue: kicker, category, level chip, active ring | `violet` #a78bfa (light #6d28d9) | **add** `--club-violet` | **add** `violet` |
| Doen, Durven fills | `violetDim` | **add** `--club-violet-dim` | **add** `violetDim` |
| Error notice, destructive action, last 5 s of the timer | `danger` #fb7185 (light #be123c), fill `dangerDim`, ink `onDanger` #1a0509 (light #ffffff) | none yet (the join error uses `--club-orange`): **add** `--club-danger`, `--club-danger-dim`, `--club-on-danger` with the mobile values | `danger`, `dangerDim`; **add** `onDanger` |

Amber and violet were added to the design system artifact for these games; their code tokens land with the first game PR. Contrast is recorded in the design system: amber on `bg` 11.84:1 (dark) and 6.78:1 (light); violet on `bg` 7.26:1 and 6.79:1; each hue on its Dim fill passes 4.5:1 in both themes. Use the token values on `main`, which include the APP-29 contrast fixes, rather than hex values copied from the artboards.

The A-direction artboard (*Directions* page) still shows the Doen, Durven level chip in `#c4b5fd`. The final screens use `violet`; build from those.

### Type

- Titles, timers and scores: Space Grotesk 700 (`club-title`). Body and controls: Manrope.
- Kicker: 11.5–12px, 800, 0.12em tracking, uppercase, in the game hue (`club-kicker` with the hue colour instead of green).
- Screen title 26px (settings, lobby), 34px (waiting, pick), 38px (end screens).
- Describer timer 96px; teammate timer 136px; opponent timer 64px. Tabular numbers on every timer, score and code.
- End-screen headline 40px (Beat the Clock winner) and 38px (Doen, Durven game over).
- Prompt text 32px, line height 1.18. A prompt over 120 characters drops to 26px (canvas state `longPrompt`).
- Where a size here and an artboard differ, the artboard wins.
- Word rows 21px 700; list rows 16px 600; captions 13–14px.

### Layout and controls

- Phone frame 390 × 844, padding 16px top, 20px sides, 24px bottom. On wider web viewports, centre a column at most 480px wide; game screens never stretch controls across a desktop.
- Header: 44px round icon button (menu or pause, `borderStrong` outline, `surface` fill), then kicker and a meta line, then a right-aligned meta (room code) when there is space.
- Primary button: pill, min-height 52px, `accent` fill, `onAccent` text 16px 800. Secondary: pill, 48px, transparent with a `borderStrong` outline, for the second choice under a primary. Tonal: pill, 44px, `accentDim` fill, for inline actions in a card (Share invite, Show QR, the host's Gedaan/Overslaan). Quiet action: text button in `accent`, min-height 44px. Every tap target is at least 44 × 44px.
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

### Light theme

Not drawn; build to this. It applies to the web `/join` page and to every mobile screen (settings, lobby, join, game, end).

In light mode use the light value of each token: `bg` #f8fafc, `surface` #ffffff, `text` #0f172a, `textMuted` #475569, `accent` #0e7490 with `onAccent` #ffffff, `danger` #be123c, `amber` #92400e, `violet` #6d28d9, `onAmber` and `onDanger` #ffffff, and the Dim fills' light values (amber and violet Dim at the same 0.09 alpha as `accentDim`). Input borders use `--club-line-strong` / `borderStrong` (3:1 after APP-29). Never hard-code an artboard hex: every ink, including the check on a ticked word and the End game label, is a token. Everything else (layout, copy, states) matches the dark artboards. On web, once the player is seated, the game screens are dark again; on mobile they stay in the app theme.

### Keyboard-open join

Not drawn; build to this, for the join screen (web on a phone, and mobile):

- The code field autofocuses only when the code is empty (state `typed`); a code from a link leaves focus on the name field.
- Web: the code field uses `autocapitalize="characters"`, `autocomplete="off"`, `inputmode="text"`, `enterkeyhint="next"`; the name field `autocomplete="nickname"`, `enterkeyhint="go"`. Mobile: code `autoCapitalize="characters"`, `autoCorrect={false}`, `returnKeyType="next"`; name `textContentType="nickname"`, `autoComplete="nickname"`, `returnKeyType="go"`. Enter in the name field submits when both are valid.
- With the keyboard open, the screen scrolls so the focused field **and** the Join button are visible above the keyboard (mobile: `KeyboardAvoidingView` or the screen's keyboard inset; web: `scrollIntoView` with `block: "nearest"` on focus). The room card can scroll off the top.
- The inline error under the code field stays visible while the field has focus.

## Component bindings

Reuse before adding. Shared web pieces live in `src/components/games/`; shared mobile pieces in `apps/mobile/src/ui/` and `apps/mobile/src/features/sessions/`.

| Need | Web | Mobile |
| --- | --- | --- |
| Settings page and create | `NewGamePage` (options as children, create/creating labels, error, `HostGate`) inside `FullscreenGamePage`. Its create button is white today; give it a primary tone option rather than forking the page | `features/<game>/setup/<game>-setup-screen.tsx` (pattern: `features/hitster/setup/hitster-setup-screen.tsx`) with `HostGate`, `Screen`, `ChoiceList` (word pack; it is a single-select radiogroup), a multi-select list for levels (add a multi-select mode to `ChoiceList` with checkbox semantics rather than a game-owned list), `Segmented`, `Button`, `Notice` |
| Room page frame | `SessionBundleRoute` + `FullscreenGameShell`; lobby content can use `RoomFrame` parts (`RoomStartButton`, `RoomLoading`) | `features/sessions/components/online-screen-frame.tsx`, `Screen`, `Card` |
| Room code and QR | `JoinCodePanel`, `QrSharePanel` | `QrCode`, `features/sessions/host/share-invite.ts` (`shareInvite`) |
| Join | `JoinPage` in `src/routes/join.tsx` (the home page's code box, `JoinGamePanel` in `src/routes/index.tsx`, only routes to it) | `features/sessions/join/join-screen.tsx`, `features/sessions/join/scan-invite-screen.tsx`, `features/sessions/use-join-session.ts`, `TextField`; Continue as: `onlineSessionHref` (`features/play/app-games.ts`) |
| Open a web page from the app (18+ rooms) | n/a | `openWebPage` in `features/sessions/session-links.ts` (ADR 0002), never `Linking.openURL` |
| Seat handling, back in seat | `src/lib/games/seat.ts`, `SeatBanner` | `features/sessions/session-seats.ts` |
| Players, kick, rename | `ParticipantList`, `ModerationActions`, `SessionHostControls` | no shared list yet (Hitster's `lobby-roster.tsx` is game-owned); build the team cards and player list in the game's folder |
| Mutations with localized errors | `useGameAction` | `useSessionAction` (`features/sessions/use-session-action.ts`) |
| End screen | `GameEndScreen` can host Beat the Clock's winner; Doen, Durven needs its stats grid | `Card`, `Button` |
| Menus | `FullscreenGameShell` today always draws a floating menu button that opens a centred "Paused" overlay (Resume / Restart / Return to Games) and fires `onPauseChange`. These games don't use it: add an optional `menu` prop to `FullscreenGameShell`, passed through by `FullscreenGamePage`, that replaces the floating button and overlay with the game's own header control. When it is set, the shell draws no floating button, no overlay and never calls `onPauseChange`; other games are unchanged. In-game screens pass the 44px menu button that opens the game's bottom sheet (opening it never pauses; only the host's **Pause for everyone** does); settings screens pass the back button (`common.gameShell.returnToGames`). There is no Return to Games item in game: players leave through **Leave room** (with its confirm), the host through **End game** and then **Back to arcade** | bottom sheet per `expo-ui` guidance; settings screens use the stack's back button |

New per-game pieces: the describer word list, the referee check list, the scoreboard row with progress, the team picker, the category picker and the prompt card. Keep each in the game's folder until a second game needs it.

Copy goes in `packages/core/src/i18n/{en,nl}/games/beatTheClock.ts` and `…/truthOrDare.ts` (one module per game, both languages, `satisfies typeof en`), with catalog entries in `packages/core/src/i18n/{en,nl}/catalog.ts` (not under `games/`). Placeholders use `fmt`, counts use `plural`. A placeholder that holds several names (`{opponents}`, a referee `{team}` with 3–4 teams, `{guessers}`, `{categories}`) is a list joined in the reader's language by a small runtime helper (`Intl.ListFormat` with `type: "conjunction"`): "Rockets and Meteors" / "Raketten en Meteoren". Team names are plural nouns, so a verb after one team or a list reads the same ("Rockets are", "Raketten zijn").

## Build order

APP-28 plans three PRs: Beat the Clock web, Doen, Durven web, then both on mobile. [ADR 0002](../../docs/adr/0002-ship-every-game-on-web-and-mobile.md) says a new game ships on web and mobile at the same time (an Expo DOM component is allowed to start). So either a web PR keeps its game out of the catalog and `features.ts` until its mobile PR lands, or each game's PR carries both platforms. Settle this when the sub-issues are cut.

## Open questions

- **English title and id for Doen, Durven of de Waarheid.** The copy here uses "Truth or Dare" with categories Do / Dare / Truth, and paths assume the game id `truth-or-dare`. Eric to confirm or rename before the catalog entry ships.
- **Behaviour the canvas didn't show, specified in the companions so no game can get stuck.** Eric can veto any of these without touching the approved screens:
  - Lobby: players still without a team when the host taps Start are added to the smallest team, so the drawn `ready` state (Lotte without a team, Start enabled) holds; the host picks or switches their own team with the same team-card toggles as players.
  - Beat the Clock: after time's up, ticks can only be removed, not added (approved choice 2 says "undo a wrong tick"; the prototype lets rows toggle both ways); a describer who doesn't send within 10 s after time runs out sends automatically; after the check confirms, every phone moves to the score after 2 s; **Leave room** asks for confirmation; the host's menu shows **Resume for everyone** while paused; ending the game mid-round with a tie shows "Tied" without an extra round.
  - Doen, Durven: a category with no prompts left is disabled, and the game ends with the summary when all three run out; random order reshuffles every round and never picks the same player twice in a row (the next player is drawn when the turn starts, so "Next: Noor" is known); the in-game menu reuses the Beat the Clock sheet with How to play, End game and Leave room; **Niveaus aanpassen** can't add 18+ while anyone in the room plays in the app.
  - Beat the Clock, team size mid-game: **Switch team** is disabled when it would leave your team with fewer than 2 players; a team that drops below 2 through **Leave room** has its turns skipped (with a notice) until it has 2 again, and the game ends with the current scores if fewer than 2 teams can still play.
  - Doen, Durven ends with the summary when fewer than 2 players are left in the rotation; a named player who leaves stays in the prompt on screen.
  - Beat the Clock: on the score screen **Skip this turn** skips the upcoming turn (for a describer whose phone doesn't respond); **Next** (only on the next describer's phone) moves every phone to the ready state; **See who won** and **Start the extra round** show on every phone and the first tap moves everyone. A skip of the last turn in a round still ends the round (target, tie and next round rules apply).
  - Join: **Join as someone else** (drawn on `alreadyIn`) is dropped, because the server gives one identity one seat; the secondary action is **Join another room**.
  - Beat the Clock, end of game: a game that ends early (host **End game**, too few teams, or the word pack running out) shows why on the winner screen and, when tied, "Tied" with normal end actions (no extra round). **Play again** is disabled while any team has fewer than 2 players; the host uses **New teams**.
  - Content running out: a game ends when its content runs out (Beat the Clock: fewer than 5 unused words at the start of a turn; Doen, Durven: all three categories empty). **Play again** excludes content used in this room until too little is left; then the exclusion resets for the new game and the host sees a notice that content will repeat.
  - Doen, Durven: while the active player is choosing, the host can skip their turn ("Reageert de telefoon van Lotte niet?"), as on the prompt screen; it counts as skipped.
  - Pause (Beat the Clock) freezes whatever phase is running: the turn clock, the 10 s auto-send and the 10 s check; on the ready or score screen it only blocks Go and the move on.
  - Join: watchers (the existing "Only watch, don't play") are kept in both games; in Beat the Clock they see the teammate view (timer and count, never the words); in Doen, Durven the watch screen without actions, and they are not in the rotation.
- **Web "already in this room".** The web seat store is per tab (sessionStorage). Round 3 binds **Continue as** to a server lookup by identity (user or per-browser guest id), so it works across tabs in the same browser; it still can't recognise a different browser or a cleared guest id. Eric to confirm this is enough.
- **Room code length.** The canvas shows a 4-letter code (`K7QX`). Real codes are 6 characters from `JOIN_CODE_ALPHABET`, shown as `ABC 123` (`formatJoinCode`). Build with real codes; the companions already use them. No design change needed.
- **Team names.** Drawn as fixed names (Comets, Rockets). The companions give a fixed list per language for 2–4 teams; renaming teams is out of scope.
- **Host disconnects.** Not designed. Follow the existing session behaviour (host role stays with the seat; the game waits on the host only for host-only actions). In Doen, Durven a host who is also the unresponsive active player can't skip their own turn from another phone; Eric to decide whether another player gets that action.

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
- **18+ as a platform exception**: ADR 0002 asks for every exception to be listed. Record the web-only 18+ level in `features.ts` (or the ADR) in the Doen, Durven PR that adds it.
- **The `generate-game-content` skill's family-friendly rule** needs a documented opt-in exception for the 18+ level: Doen, Durven web PR.
- **White primary buttons in existing web rooms** (Bluff Dice, `NewGamePage`, `RoomStartButton`): a separate design-system alignment issue if Eric wants the rooms to match. Not part of these games.
