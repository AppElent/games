# Room and join: final study

Hosting, joining and the lobby for both party games. Shared rules, tokens, larger text, light theme and keyboard behaviour are in the [overview](README.md); this companion covers each screen's states, actions and exact copy.

- Canvas: [Arcade Club party games](https://claude.ai/artifact/LnbzrJHgP1Etu4RqnLDxF5), page **Room and join** (version `1794588444-dabe`)
- Artboard source: [room-and-join_final/](room-and-join_final/)
- Flow: canvas page *Flows*, "Flow 1 · Host a room and join"

Example data on every screen: room code `K7Q 4MR` (the canvas shows `K7QX`; real codes are 6 characters, see [open questions](README.md#open-questions)), host Sam (Beat the Clock) or Lotte (Doen, Durven), players Noor, Daan, Mila, Jesse, Lotte.

Copy keys are suggestions for `packages/core/src/i18n/{en,nl}/games/beatTheClock.ts` (`clock.*`) and `truthOrDare.ts` (`truth.*`). Strings shared by both games are listed once under `room.*`; put them in each game's module or in `common` if a third game needs them. `{x}` is a `fmt` placeholder; `{n|one|other}` means a `plural`.

## Flow

1. Catalog card → **Host room** → room settings (screens 1, 2).
2. Create → host lobby (screen 3). Host shares the code or QR.
3. Players scan, type the code or open the link → join (screen 4) → player lobby (screen 5).
4. Host taps **Start game** → every phone switches to the game's first screen ([Beat the Clock](beat-the-clock_final.md), [Doen, Durven](doen-durven_final.md)).
5. A player whose device already holds a seat skips the name step: "already in this room" (screen 4, `alreadyIn`).

Ready rule: Beat the Clock needs at least 2 teams with at least 2 players each; Doen, Durven needs at least 2 players. Until then Start is disabled and a line above it says what is missing.

## 1. Room settings · Beat the Clock

`Host-SettingsClock.dc.html`. Web: `src/routes/beat-the-clock/new.tsx` with `NewGamePage`. Mobile: the game's host screen under `features/sessions/host`.

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
| `room.back` (aria) | Back to games | Terug naar spellen |
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
| `room.creating` | Creating room… | Kamer openen… |
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
| `creating` | Button disabled with spinner "Kamer openen…" |
| `error` | Alert above the button; button reads **Opnieuw proberen** |
| `app` (mobile) | 18+ row is absent; an info row says "18+ speel je alleen in de browser, niet in de app." |

The server must reject an 18+ room created from the app, and an 18+ room without the confirmation, even if a client sends it.

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
| `ready` | Teams or players filled; Start enabled when the ready rule holds |
| not ready (some team under 2, or only 1 player) | Start disabled; line above it: "Each team needs at least 2 players." / "You need at least 2 players." |
| `alone` (only the host) | Empty state in place of the list: icon, "Nobody has joined yet", body; Start disabled |
| QR shown | 96px QR (light tile) inside the code card; the toggle reads **Hide QR** and is `aria-pressed="true"` |
| `starting` | Start disabled with spinner "Starting…" |
| `error` | Alert above Start: "The game couldn't start. Try again." |

Actions:

- **Share invite**: native share sheet with the join URL (`/join?code=…`); fallback copies the link and confirms with "Link copied".
- **Show QR / Hide QR**: toggles the QR of the join URL (`QrSharePanel` on web, `QrCode` on mobile).
- **Shuffle teams** (Beat the Clock): spreads all players, including those without a team, evenly over the teams at random. Players can still switch after a shuffle until Start.
- **Start game**: locks settings and teams, starts the session, routes everyone.
- Menu (`Room menu`): the existing session controls (rename, lock, kick via `SessionHostControls` and `ModerationActions`), plus **How to play**.

Team card: amber team chip (`amberDim` fill), count on the right ("2 players"), names in rows of 36px; the host's own row reads "Sam (you)". Players without a team are listed in the strip under the cards.

| Key | en | nl |
| --- | --- | --- |
| `room.lobby` | Lobby | Lobby |
| `room.menu` (aria) | Room menu | Kamermenu |
| `clock.lobby.meta` | {seconds} s · first to {target} | {seconds} s · eerst bij {target} |
| `truth.lobby.meta` | In order / Random | Op volgorde / Willekeurig |
| `room.code` | Room code | Kamercode |
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
| `truth.lobby.summary` | {n} players · {levels} | {n} spelers · {levels} |
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

`Host-Join.dc.html`. Web: `src/routes/join.tsx` with `JoinGamePanel` (normal app chrome, follows the app theme, see [light theme](README.md#light-theme-join-page)). Mobile: `features/sessions/join`. Keyboard behaviour: [keyboard-open join](README.md#keyboard-open-join).

Layout: back button and "Join a room"; a room card when the code matches a room (game icon tile in the game's hue and Dim fill, game name, host and player count); the **Room code** field with a hint; the **Your name** field with a hint; **Join room** pinned to the bottom.

| State | What shows |
| --- | --- |
| `fromLink` | Code filled from the link, room card shown, name empty, Join disabled until a name is typed |
| `typed` | Code empty and focused; no room card; Join disabled |
| code complete and found | Room card appears under the title |
| `wrongCode` | Code field border and hint in `danger`, `aria-invalid="true"`; hint "No room has this code. Check it with the host."; no room card |
| `joining` | Join disabled with spinner "Joining…" |
| `alreadyIn` | No form. Card "You're already in this room as Noor" with **Continue as Noor** (primary) and **Join as someone else** (secondary) |
| `adultInApp` (mobile only) | No form. Card "Open this room in your browser" with **Open in browser** (primary, opens the web join URL) and **Join another room** (secondary, clears the code) |
| signed in | Name prefilled from the profile name, still editable |

Rules: the code field upper-cases input and strips spaces, accepts 6 characters, and shows them as `ABC 123` (`normalizeJoinCode`, `formatJoinCode`). Name: 1–20 characters, trimmed. The room is looked up as soon as the code is complete; a wrong code shows the error without a submit. **Continue as Noor** goes straight back into the seat (lobby or the turn in progress). **Join as someone else** shows the form with the name empty and takes a new seat.

| Key | en | nl |
| --- | --- | --- |
| `room.back` (aria) | Back | Terug |
| `room.joinHeading` | Join a room | Meedoen met een kamer |
| `room.foundMeta` | Hosted by {host} · {n\|1 player\|{n} players} | Host: {host} · {n\|1 speler\|{n} spelers} |
| `room.foundMetaAdult` | Hosted by {host} · 18+ | Host: {host} · 18+ |
| `room.codeLabel` | Room code | Kamercode |
| `room.codeHint` | Ask the host for the code, or scan their QR code. | Vraag de host om de code, of scan de QR-code. |
| `room.codeWrong` | No room has this code. Check it with the host. | Geen kamer met deze code. Check het bij de host. |
| `room.nameLabel` | Your name | Je naam |
| `room.namePlaceholder` | What should the others call you? | Hoe moeten de anderen je noemen? |
| `room.nameHint` | No account needed. Signed in? We use your profile name. | Geen account nodig. Ingelogd? Dan gebruiken we je profielnaam. |
| `room.join` | Join room | Meedoen |
| `room.joining` | Joining… | Meedoen… |
| `room.alreadyInTitle` | You're already in this room as {name} | Je zit al in deze kamer als {name} |
| `room.alreadyInBody` | This phone kept your seat. Your team and score are waiting. | Deze telefoon heeft je plek bewaard. Je team en score staan klaar. |
| `room.continueAs` | Continue as {name} | Verder als {name} |
| `room.joinAsOther` | Join as someone else | Meedoen als iemand anders |
| `truth.appBlockedTitle` | Open this room in your browser | Open deze kamer in je browser |
| `truth.appBlockedBody` | The host turned on 18+ prompts. Those rooms are only playable in a browser, not in the app. | De host heeft 18+-opdrachten aangezet. Zulke kamers speel je alleen in de browser, niet in de app. |
| `room.openInBrowser` | Open in browser | Openen in browser |
| `room.joinAnother` | Join another room | Andere kamer kiezen |

Copy change from the canvas: the wrong-code hint drew "codes are 4 letters"; real codes are 6 characters, so the hint drops that clause. For Doen, Durven the "already in" body reads "This phone kept your seat." without the team and score sentence (`room.alreadyInBodyTruth`: "This phone kept your seat." / "Deze telefoon heeft je plek bewaard.").

Existing join strings in `common.joinPanel` (`submit`, `openOnWeb`, `unsupportedGame`) may replace the new keys where the wording matches; keep one string per meaning.

## 5. Lobby · player

`Host-LobbyPlayer.dc.html`. Beat the Clock only; Doen, Durven players see the host lobby's player list without Start and Shuffle, with the status line at the bottom (not drawn separately; same layout as screen 3 `listView` minus the host actions).

Layout: menu button, kicker, host and settings line, room code; a title and subtitle; two team cards as large toggle buttons; a status line with a pulse dot.

| State | What shows |
| --- | --- |
| `pickTeam` | "Pick your team"; both cards show **Join Comets** / **Join Rockets**; status "Pick a team to get ready" |
| `onTeam` | The chosen card has a cyan border, check badge and "You" in its list, `aria-pressed="true"`; the other card shows **Switch**; status "Waiting for Sam to start the game" |
| `lateJoin` (game running) | "Game in progress"; subtitle names the running turn; after picking: "You play from your team's next turn…", status "Rockets are describing now. Hang on." |
| `loading` | Skeleton blocks in place of title and cards, `aria-busy="true"`, label "Loading the room" |
| removed by the host | Existing session behaviour (`SeatBanner` message, back to `/join`) |

Doen, Durven player lobby status: "Waiting for Lotte to start the game" / "Wachten tot Lotte het spel start". Late joiners there skip this screen and land on the waiting screen at the end of the rotation.

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
| `clock.lobby.statusLate` | {team} are describing now. Hang on. | {team} zijn nu aan het omschrijven. Even geduld. |

## Not drawn, built to the overview

- Light theme of screen 4 on the web: [light theme](README.md#light-theme-join-page).
- Larger system text for all five screens: [larger system text](README.md#larger-system-text).
- Screen 4 with the keyboard open: [keyboard-open join](README.md#keyboard-open-join).
- English copy of screens 2 and Doen, Durven's lobby, Dutch copy of screens 1, 4 and 5: the tables above.
