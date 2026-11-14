# Room and join: final study

Hosting, joining and the lobby for both party games. Shared rules, tokens, larger text, light theme and keyboard behaviour are in the [overview](README.md); this companion covers each screen's states, actions and exact copy.

- Canvas: [Arcade Club party games](https://claude.ai/artifact/LnbzrJHgP1Etu4RqnLDxF5), page **Room and join** (version `1794588444-dabe`)
- Artboard source: [room-and-join_final/](room-and-join_final/)
- Flow: canvas page *Flows*, "Flow 1 · Host a room and join"

Example data on every screen: room code `K7Q 4MR` (the canvas shows `K7QX`; real codes are 6 characters, see [open questions](README.md#open-questions)), host Sam (Beat the Clock) or Lotte (Doen, Durven), players Noor, Daan, Mila, Jesse, Lotte.

Copy keys are suggestions for `packages/core/src/i18n/{en,nl}/games/beatTheClock.ts` (`clock.*`) and `truthOrDare.ts` (`truth.*`). Strings shared by both games are listed once under `room.*`; put them in each game's module or in `common` if a third game needs them. The join screen (4) serves every game, so its keys go in `common.joinPanel.*`. `{x}` is a `fmt` placeholder; `{n|one|other}` means a `plural` on the count `n` (in code `plural()` fills `{count}`, so write the forms as `"1 player"` / `"{count} players"`).

## Flow

1. Catalog card → **Host room** → room settings (screens 1, 2).
2. Create → host lobby (screen 3). Host shares the code or QR.
3. Players scan, type the code or open the link → join (screen 4) → player lobby (screen 5).
4. Host taps **Start game** → every phone switches to the game's first screen ([Beat the Clock](beat-the-clock_final.md), [Doen, Durven](doen-durven_final.md)).
5. A player whose identity (signed-in user, or this browser's or phone's guest id) already holds a seat skips the name step: "already in this room" (screen 4, `alreadyIn`).

Ready rule: in Beat the Clock every team (the Teams setting, 2–4) has at least 2 players; in Doen, Durven at least 2 players are in the room. Watchers don't count. Until then Start is disabled and a line above it says what is missing. Players still without a team when the host taps Start are added to the smallest team (ties: the lowest team number) and count toward the rule.

## 1. Room settings · Beat the Clock

`Host-SettingsClock.dc.html`. Web: `src/routes/beat-the-clock/new.tsx` with `NewGamePage`. Mobile: `features/beat-the-clock/setup/beat-the-clock-setup-screen.tsx` (pattern: `features/hitster/setup/hitster-setup-screen.tsx`).

Layout, top to bottom: back button and title; **Word pack** radio list (4 rows); three segmented controls (time per turn, points to win, teams); a language note; the create button pinned to the bottom.

| Control | Options | Default |
| --- | --- | --- |
| Word pack | Everyday 400 cards · Movies and TV 250 · Around the world 250 · Kids 200 | Everyday |
| Time per turn | 30 s · 45 s · 60 s | 30 s |
| Points to win | 20 · 30 · 50 | 30 |
| Teams | 2 · 3 · 4 | 2 |

Card counts come from the content pack, not hard-coded; the numbers are content targets.

| State | What shows |
| --- | --- |
| `ready` | Controls enabled, **Host room** enabled |
| `creating` | Controls stay visible; button disabled with spinner "Creating room…" |
| `error` | `dangerDim` alert above the button; button reads **Try again** |
| signed out, guest hosting not allowed | `HostGate` as today |

Action: **Host room** creates the session with the settings and the host's app language, then routes to the host lobby.

| Key | en | nl |
| --- | --- | --- |
| `clock.title` | Beat the Clock | Tegen de Klok |
| `common.gameShell.returnToGames` (existing, aria) | Return to Games | Terug naar spellen |
| `room.hostHeading` | Host a room | Kamer openen |
| `clock.settings.pack` | Word pack | Woordenpakket |
| `clock.packs.everyday` | Everyday | Alledaags |
| `clock.packs.screen` | Movies and TV | Films en tv |
| `clock.packs.world` | Around the world | De wereld rond |
| `clock.packs.kids` | Kids | Kinderen |
| `clock.settings.cards` | {n\|1 card\|{n} cards} | {n\|1 kaart\|{n} kaarten} |
| `clock.settings.timer` | Time per turn | Tijd per beurt |
| `clock.settings.seconds` | {n} s | {n} s |
| `clock.settings.target` | Points to win | Punten om te winnen |
| `clock.settings.teams` | Teams | Teams |
| `clock.settings.note` | Cards are in English, the language of your app. Players pick a team in the lobby. | Kaarten zijn in het Nederlands, de taal van je app. Spelers kiezen een team in de lobby. |
| `room.create` | Host room | Kamer openen |
| `room.creating` | Creating room… | Kamer wordt geopend… |
| `room.createError` | We couldn't create the room. Check your connection and try again. | De kamer kon niet worden geopend. Controleer je verbinding en probeer het opnieuw. |
| `room.retry` | Try again | Opnieuw proberen |

The note names the content language, which is the host's app language: the English string is shown to an English host, the Dutch string to a Dutch host.

## 2. Room settings · Doen, Durven

`Host-SettingsTruth.dc.html`. Web: `src/routes/truth-or-dare/new.tsx`. Mobile: as screen 1.

Layout: back button and title; **Levels** checkbox list (3 rows on web, 2 in the app); the 18+ confirmation (only while 18+ is ticked); **Turn order** segmented control; a note; the create button.

| Control | Options | Default |
| --- | --- | --- |
| Levels (one or more) | Familie · Feest · 18+ (web only) | Familie |
| 18+ confirmation | checkbox "Iedereen in deze kamer is 18 of ouder" | unticked, reset whenever 18+ is unticked |
| Turn order | Op volgorde (join order) · Willekeurig (random) | Op volgorde |

| State | What shows |
| --- | --- |
| `ready` | Familie ticked; button enabled |
| no level ticked | Button disabled; line above it "Kies minstens één niveau." |
| `adult` (18+ ticked, not confirmed) | Confirmation card appears (violet outline, `violetDim` fill); button disabled with "Bevestig eerst dat iedereen 18 of ouder is." |
| 18+ ticked and confirmed | Button enabled |
| `creating` | Button disabled with spinner "Kamer wordt geopend…" |
| `error` | Alert above the button; button reads **Opnieuw proberen** |
| `app` (mobile) | 18+ row is absent; an info row says "18+ speel je alleen in de browser, niet in de app." |
| signed out (`HostGate`) | As screen 1 |

The server enforces the web-only rule whatever a client sends: the app passes its platform with create, join and level changes, and the server rejects an 18+ room created from the app, an 18+ room without the confirmation, and a join from the app into an 18+ room (the app then shows the `adultInApp` state of screen 4). The game's state query and mutations also refuse an app client in an 18+ room, so an existing seat can't be used from the app either: on mobile, `adultInApp` takes precedence over `alreadyIn` on screen 4, and the app's game screen shows the `adultInApp` card when a stored seat points to an 18+ room.

### Changing levels after a game

**Niveaus aanpassen** on the game-over screen opens this screen in edit mode for the existing room: the same controls with the room's current values, the title "Niveaus aanpassen" / "Change levels" and the action **Opslaan** / **Save** (pending "Opslaan…" / "Saving…"). It calls a game mutation that updates the room's levels and order (suggested `truthOrDare.updateSettings`, host only, between games only), then returns everyone to the lobby. It is not `NewGamePage`, which only creates. While any seated player joined from the app, the 18+ row is disabled with the hint below, and the server rejects 18+ for that room.

| Key | en | nl |
| --- | --- | --- |
| `truth.settings.editHeading` | Change levels | Niveaus aanpassen |
| `truth.settings.save` | Save | Opslaan |
| `truth.settings.saving` | Saving… | Opslaan… |
| `truth.settings.adultBlockedByApp` | 18+ isn't available: someone in this room plays in the app. | 18+ kan niet: iemand in deze kamer speelt in de app. |

| Key | en | nl |
| --- | --- | --- |
| `truth.title` | Truth or Dare | Doen, Durven of de Waarheid |
| `truth.kicker` | Truth or dare | Doen, durven of de waarheid |
| `room.hostHeading` | Host a room | Kamer openen |
| `truth.settings.levels` | Levels · pick one or more | Niveaus · kies er een of meer |
| `truth.levels.family` | Family | Familie |
| `truth.levels.familyHint` | For all ages | Voor alle leeftijden |
| `truth.levels.party` | Party | Feest |
| `truth.levels.partyHint` | Sillier and more embarrassing, 12+ | Gekker en gênanter, vanaf 12 |
| `truth.levels.adult` | 18+ | 18+ |
| `truth.levels.adultHint` | Spicy, adults only | Pikant, alleen voor volwassenen |
| `truth.settings.adultConfirm` | Everyone in this room is 18 or older | Iedereen in deze kamer is 18 of ouder |
| `truth.settings.adultConfirmHint` | Spicy questions and dares, never explicit. Anyone can skip. | Spannende vragen en opdrachten, nooit expliciet. Wie wil, slaat over. |
| `truth.settings.adultWebOnly` | 18+ is only playable in a browser, not in the app. | 18+ speel je alleen in de browser, niet in de app. |
| `truth.settings.order` | Turn order | Volgorde |
| `truth.settings.inOrder` | In order | Op volgorde |
| `truth.settings.random` | Random | Willekeurig |
| `truth.settings.note` | Prompts are in English, the language of your app. No points: you end the game whenever you like. | Opdrachten zijn in het Nederlands, de taal van je app. Geen punten: jij beëindigt het spel wanneer je wilt. |
| `truth.settings.needLevel` | Pick at least one level. | Kies minstens één niveau. |
| `truth.settings.needConfirm` | First confirm that everyone is 18 or older. | Bevestig eerst dat iedereen 18 of ouder is. |
| `room.create` / `room.creating` / `room.createError` / `room.retry` | as screen 1 | as screen 1 |

## 3. Lobby · host

`Host-Lobby.dc.html` (tweaks `game`: clock or truth; `state`). Web: the session route's lobby phase. Mobile: the session screen's lobby phase.

Layout: menu button, kicker, "Lobby", settings summary on the right; the code card (code at 36px with 8px tracking, **Share invite** and **Show QR** side by side, the QR appears inside the card when shown); then Beat the Clock's two-column team cards plus a "No team yet" strip with **Shuffle teams**, or Doen, Durven's player list; Start pinned to the bottom.

| State | What shows |
| --- | --- |
| `ready` | Teams or players filled; Start enabled when the ready rule holds (players in "No team yet" join the smallest team on Start) |
| not ready (some team under 2 players, or fewer than 2 players) | Start disabled; line above it: "Each team needs at least 2 players." / "You need at least 2 players." |
| `alone` (only the host) | Empty state in place of the list: icon, "Nobody has joined yet", body; Start disabled |
| QR shown | 96px QR (light tile) inside the code card; the toggle reads **Hide QR** and is `aria-pressed="true"` |
| `starting` | Start disabled with spinner "Starting…" |
| `error` | Alert above Start: "The game couldn't start. Try again." |

Actions:

- **Share invite**: native share sheet with the join URL (`/join?code=…`); fallback copies the link and confirms with "Link copied".
- **Show QR / Hide QR**: toggles the QR of the join URL (`QrSharePanel` on web, `QrCode` on mobile).
- **Shuffle teams** (Beat the Clock): spreads all players, including those without a team, evenly over the teams at random. Players can still switch after a shuffle until Start.
- **Start game**: locks settings and teams, starts the session, routes everyone.
- Menu (`Room menu`, `room.menuLabel`), the only control in the header's `menu` slot:
  - Web: the existing session controls (rename, lock, kick via `SessionHostControls` and `ModerationActions`), then **How to play**, then **Return to Games** (`common.gameShell.returnToGames`, a link to `/`) as the last item. That item is the host's way out of the lobby on web; the room stays open as rooms do today, and the host gets back in through **Continue as**.
  - Mobile: **How to play** only. The app has no rename, lock or kick today (it calls none of `sessions.rename`, `setLocked`, `kickParticipant`), and these games don't add them; the host leaves with the stack's back button. Moderation from the app is leftover parity work. Closing a room that hasn't started is not part of this design.
- Player lobby menu (screen 5, and the Doen, Durven player lobby): **How to play** · **Leave room** (danger, with the confirm from the [pause menu](beat-the-clock_final.md#8-pause-menu)). Team switching stays on the team cards. Watchers get the same menu.

Team card: amber team chip (`amberDim` fill), count on the right ("2 players"), names in rows of 36px; the host's own row reads "Sam (you)". Players without a team are listed in the strip under the cards.

The host is a player too. Their team cards are the same toggle buttons as the player lobby (screen 5): tapping a card puts the host on that team (`aria-pressed`, cyan border on the host's team, **Join {team}** / **Switch** on the others). The drawn plain cards are the host's view after picking.

With 3 or 4 teams the cards form a 2 × 2 grid (a third team spans one cell, leaving the fourth empty). Players are moved between teams only by themselves or by **Shuffle teams**; the host does not drag players.

| Key | en | nl |
| --- | --- | --- |
| `room.lobby` | Lobby | Lobby |
| `room.menuLabel` (aria) | Room menu | Kamermenu |
| `clock.lobby.meta` | {seconds} s · first to {target} | {seconds} s · eerst bij {target} |
| `truth.lobby.meta` | In order / Random | Op volgorde / Willekeurig |
| `common.session.roomCode` (existing) | Room code | Kamercode |
| `room.share` | Share invite | Uitnodigen |
| `room.linkCopied` | Link copied | Link gekopieerd |
| `room.showQr` | Show QR | Toon QR |
| `room.hideQr` | Hide QR | Verberg QR |
| `room.qrAlt` | QR code to join room {code} | QR-code om mee te doen in kamer {code} |
| `room.emptyTitle` | Nobody has joined yet | Nog niemand binnen |
| `room.emptyBody` | Share the code or show the QR code. Players join on their own phone. | Deel de code of laat de QR-code zien. Iedereen speelt op een eigen telefoon. |
| `room.you` | {name} (you) | {name} (jij) |
| `clock.lobby.teamCount` | {n\|1 player\|{n} players} | {n\|1 speler\|{n} spelers} |
| `clock.lobby.noTeam` | No team yet: {names} | Nog geen team: {names} |
| `clock.lobby.shuffle` | Shuffle teams | Teams husselen |
| `clock.lobby.need` | Each team needs at least 2 players. | Elk team heeft minstens 2 spelers nodig. |
| `truth.lobby.summary` | {n\|1 player\|{n} players} · {levels} | {n\|1 speler\|{n} spelers} · {levels} |
| `truth.lobby.need` | You need at least 2 players. | Je hebt minstens 2 spelers nodig. |
| `room.start` | Start game | Spel starten |
| `room.starting` | Starting… | Starten… |
| `room.startError` | The game couldn't start. Try again. | Het spel kon niet starten. Probeer het opnieuw. |
| `room.howToPlay` | How to play | Zo speel je |

Copy change from the canvas: the Dutch empty-state body drew "op zijn eigen telefoon"; use the neutral "op een eigen telefoon".

Team names, in order of team number:

| Key | en | nl |
| --- | --- | --- |
| `clock.teams` | Comets, Rockets, Meteors, Satellites | Kometen, Raketten, Meteoren, Satellieten |

## 4. Join · code and name

`Host-Join.dc.html`. Web: `JoinPage` in `src/routes/join.tsx` (normal app chrome, follows the app theme, see [light theme](README.md#light-theme)). Mobile: `features/sessions/join`. Keyboard behaviour: [keyboard-open join](README.md#keyboard-open-join).

Layout: back button and "Join a room"; a room card when the code matches a room (game icon tile in the game's hue and Dim fill, game name, host and player count); the **Room code** field with a hint; the **Your name** field with a hint; **Join room** pinned to the bottom.

| State | What shows |
| --- | --- |
| `fromLink` | Code filled from the link, room card shown, name empty, Join disabled until a name is typed |
| `typed` | Code empty and focused; no room card; Join disabled |
| code complete and found | Room card appears under the title |
| `wrongCode` | Code field border and hint in `danger`, `aria-invalid="true"`; hint "No room has this code. Check it with the host."; no room card |
| `joining` | Join disabled with spinner "Joining…" |
| `alreadyIn` | No form. Card "You're already in this room as Noor" with **Continue as Noor** (primary) and **Join another room** (secondary, `common.joinPanel.joinAnother`, clears the code) |
| join failed | Inline error above **Join room**, in `danger` with `role="alert"`, from the existing server error copy (`serverErrors`): `roomLocked` "This room is locked by the host.", `removedByHost`, `signInToJoin` (error text only; the join screen has no sign-in button), `roomNotFound` (code), `gameUnavailable` (invite token); a network failure uses `common.joinPanel.joinError`. The form stays filled. |
| invite token unknown or expired | No room card; the preview returns `null`, so the inline error shows `gameUnavailable` ("This game is no longer available.") and the code field appears so the player can type a code instead |
| `adultInApp` (mobile only) | No form. Card "Open this room in your browser" with **Open in browser** (primary, opens the web join URL) and **Join another room** (secondary, clears the code and any invite token) |
| signed in | Name prefilled from the profile name, still editable |

Rules: the code field upper-cases input and strips spaces, keeps the existing `isJoinCodeLike` check (new codes are 6 characters), and shows them as `ABC 123` (`normalizeJoinCode`, `formatJoinCode`). Name: 1–20 characters, trimmed; the 20-character limit is new, so the server (`convex/lib/join.ts`) must validate it too. The room is looked up as soon as the code is complete; a wrong code shows the error without a submit. Mobile caps names at `PLAYER_NAME_MAX` (32, `features/players/identity/use-player-identity.ts`); lower it to 20 so both clients match the server (this also caps the stored profile name on the phone). A longer signed-in profile name is cut to 20 when prefilled. The host's name goes through `convex/lib/hostedSession.ts`, so validate it there too. **Continue as Noor** goes straight back into the seat (lobby or the turn in progress).

The canvas also drew **Join as someone else** on `alreadyIn`. It is dropped: the server admits by identity (`admitParticipant` in `convex/lib/join.ts` hands back the existing row for the same user or guest id), so a second seat from the same identity is not possible today. The secondary action is **Join another room** instead.

API: the room card and the instant wrong-code check need a lookup. Today `api.sessions.inviteGameType` returns only the game type. Extend it, or add a sibling query (suggested `sessions.invitePreview`), taking the same inputs as `inviteGameType` (`joinCode` **or** `shareToken`) plus an optional `guestId`, and returning `null` when nothing matches, otherwise `sessionId`, game type, host display name, player count, whether the room has the 18+ level, and the display name and `participantId` of the caller's own seat when one exists. The caller's seat is found the way `admitParticipant` finds it: by the signed-in user, otherwise by `guestId` (web: the per-browser guest id in `src/lib/games/sessions.ts`; mobile: `usePlayerIdentity`), skipping kicked seats.

Lookups: a typed or linked code calls the preview with `joinCode`; an invite link (`/join?token=…`, mobile invite deep link) calls it with `shareToken`, and the room card replaces the code field. `null` gives `wrongCode` for a code and the invite error for a token. The 18+ flag drives `adultInApp` on mobile for both paths. `alreadyIn` shows only when the preview returns a seat. **Continue as** writes that seat to the local seat store (web `rememberSeat` in `src/lib/games/seat.ts`; mobile `session-seats.ts`) and navigates to it: web `getSessionPath(gameType, sessionId, participantId)` (`src/lib/games/catalog.ts`), mobile `onlineSessionHref` (`features/play/app-games.ts`). Because the lookup is by identity, Continue as also works from a new tab in the same browser.

The restyle, the room card and the 20-character name limit (shared `convex/lib/join.ts`) apply to every game's join, not only these two.

Existing join actions stay. This screen restyles the shared `/join` page and the app's join screen; it keeps every action they have today:

| Existing action | Where it goes |
| --- | --- |
| **Only watch, don't play** (`common.joinPanel.watchOnly`, `asSpectator`) | A checkbox under the name field, unchanged. Watchers don't count for the ready rule, don't get a team or a turn, see the watcher view in Beat the Clock ([turn · teammate, watchers](beat-the-clock_final.md#2-turn--teammate); never the words while a turn runs) and the watch screen without actions in Doen, Durven. |
| Invite link (`/join?token=…`, "Claim your seat", `joinByToken`) | Same screen: the code field is replaced by the room card, the title reads `common.joinPanel.claimSeat`, and the existing invite notice shows above the name field. |
| **Scan QR code** (mobile, `scan-invite-screen.tsx`) | A tonal button under the code field, as today. |
| Unsupported game in the app (`common.joinPanel.unsupportedGame`, **Open on the web**) | Unchanged for games not in the app. For an 18+ room the specific `adultInApp` card replaces it. |

| Key | en | nl |
| --- | --- | --- |
| `common.joinPanel.back` (aria) | Back | Terug |
| `common.joinPanel.title` (existing) | Join a game | Doe mee aan een spel |
| `common.joinPanel.foundMeta` | Hosted by {host} · {n\|1 player\|{n} players} | Host: {host} · {n\|1 speler\|{n} spelers} |
| `common.joinPanel.foundMetaAdult` | Hosted by {host} · 18+ | Host: {host} · 18+ |
| `common.session.roomCode` (existing) | Room code | Kamercode |
| `common.joinPanel.codeHint` | Ask the host for the code, or scan their QR code. | Vraag de host om de code, of scan de QR-code. |
| `common.joinPanel.codeWrong` | No room has this code. Check it with the host. | Geen kamer met deze code. Vraag het na bij de host. |
| `common.joinPanel.nameLabel` | Your name | Je naam |
| `common.joinPanel.namePlaceholder` | What should the others call you? | Hoe moeten de anderen je noemen? |
| `common.joinPanel.nameHint` | No account needed. Signed in? We use your profile name. | Geen account nodig. Ingelogd? Dan gebruiken we je profielnaam. |
| `common.joinPanel.submit` (existing) | Join | Meedoen |
| `common.joinPanel.joining` | Joining… | Bezig met meedoen… |
| `common.joinPanel.alreadyInTitle` | You're already in this room as {name} | Je zit al in deze kamer als {name} |
| `common.joinPanel.alreadyInBody` | Your seat is still yours. | Je plek is nog van jou. |
| `common.joinPanel.continueAs` | Continue as {name} | Verder als {name} |
| `common.joinPanel.adultTitle` | Open this room in your browser | Open deze kamer in je browser |
| `common.joinPanel.adultBody` | The host turned on 18+ prompts. Those rooms are only playable in a browser, not in the app. | De host heeft 18+-opdrachten aangezet. Zulke kamers speel je alleen in de browser, niet in de app. |
| `common.joinPanel.openInBrowser` | Open in browser | Openen in browser (opens the web join URL with `openWebPage`) |
| `common.joinPanel.joinAnother` | Join another room | Andere kamer kiezen |

Copy change from the canvas: the wrong-code hint drew "codes are 4 letters"; real codes are 6 characters, so the hint drops that clause. The canvas title "Join a room" and button "Join room" use the existing `common.joinPanel` strings instead; the canvas "already in" body ("This phone kept your seat…") becomes "Your seat is still yours.", which is true for signed-in players on any device too. The room card's icon tile uses each game's catalog `icon` and hue: these two games use `amber` / `violet`; other games use their web catalog `accent` (`src/lib/games/catalog.ts`) and the mobile catalog colour. The restyle replaces `common.joinPanel.subtitle`, `kicker`, `enterCode`, `displayName` and `playerNamePlaceholder`; delete them when no screen uses them.

Existing join strings in `common.joinPanel` (`submit`, `openOnWeb`, `unsupportedGame`) may replace the new keys where the wording matches; keep one string per meaning.

## 5. Lobby · player

`Host-LobbyPlayer.dc.html`. Beat the Clock only; Doen, Durven players see the host lobby's player list without Start and Shuffle, with the status line at the bottom (not drawn separately; same layout as screen 3 `listView` minus the host actions).

Layout: menu button, kicker, host and settings line, room code; a title and subtitle; two team cards as large toggle buttons; a status line with a pulse dot.

| State | What shows |
| --- | --- |
| `pickTeam` | "Pick your team"; both cards show **Join Comets** / **Join Rockets**; status "Pick a team to get ready" |
| `onTeam` | The chosen card has a cyan border, check badge and "You" in its list, `aria-pressed="true"`; the other card shows **Switch**; status "Waiting for Sam to start the game" |
| `lateJoin` (game running) | "Game in progress"; subtitle names the running turn; after picking: "You play from your team's next turn…", status `clock.lobby.statusLate` ("Rockets are playing now. You're in from your team's next turn.") |
| `lateJoin` (game running), when it ends | The late joiner stays on this screen (and does not referee) until their team's next ready state, then moves into the game screens with everyone else. If the game ends first (picked a team or not), they see the `player` end screen |
| `loading` | Skeleton blocks in place of title and cards, `aria-busy="true"`, label "Loading the room" |
| removed by the host | Existing session behaviour (`SeatBanner` message, back to `/join`) |

Doen, Durven player lobby status: "Waiting for Lotte to start the game" / "Wachten tot Lotte het spel start". Late joiners there skip this screen and land on the screen everyone else sees for the current turn (the waiting screen while someone chooses, the watch screen while a prompt shows), at the end of the rotation.

| Key | en | nl |
| --- | --- | --- |
| `clock.lobby.hostedMeta` | Hosted by {host} · {seconds} s · first to {target} | Host: {host} · {seconds} s · eerst bij {target} |
| `room.roomCode` | Room {code} | Kamer {code} |
| `room.loading` (aria) | Loading the room | Kamer laden |
| `clock.lobby.pickTitle` | Pick your team | Kies je team |
| `clock.lobby.pickBody` | Tap a team. Teams should be about even. | Tik op een team. Hou de teams ongeveer even groot. |
| `clock.lobby.onTeamTitle` | You're on {team} | Je zit bij {team} |
| `clock.lobby.onTeamBody` | You can switch until {host} starts the game. | Je kunt wisselen tot {host} het spel start. |
| `clock.lobby.lateTitle` | Game in progress | Spel is bezig |
| `clock.lobby.lateBody` | Turn {turn} is running. Pick a team and you join from its next turn. | Beurt {turn} is bezig. Kies een team; je doet mee vanaf de volgende beurt van dat team. |
| `clock.lobby.lateOnTeamBody` | You play from your team's next turn. You can switch teams until then. | Je speelt mee vanaf de volgende beurt van je team. Tot dan kun je nog wisselen. |
| `clock.lobby.join` | Join {team} | Naar {team} |
| `clock.lobby.switch` | Switch | Wissel |
| `clock.lobby.youInList` | You | Jij |
| `clock.lobby.statusPick` | Pick a team to get ready | Kies een team om klaar te staan |
| `room.statusWaiting` | Waiting for {host} to start the game | Wachten tot {host} het spel start |
| `clock.lobby.statusLate` | {team} are playing now. You're in from your team's next turn. | {team} zijn nu aan de beurt. Je doet mee vanaf de volgende beurt van je team. |

## Not drawn, built to the overview

- Light theme of screen 4 on the web: [light theme](README.md#light-theme).
- Larger system text for all five screens: [larger system text](README.md#larger-system-text).
- Screen 4 with the keyboard open: [keyboard-open join](README.md#keyboard-open-join).
- English copy of screens 2 and Doen, Durven's lobby, Dutch copy of screens 1, 4 and 5: the tables above.
