# Doen, Durven of de Waarheid: final study

The in-game screens of Doen, Durven of de Waarheid, from the first pick to the end screen. Hosting and the lobby are in [room and join](room-and-join_final.md); tokens, type, motion, accessibility, larger text and component bindings are in the [overview](README.md).

- Canvas: [Arcade Club party games](https://claude.ai/artifact/LnbzrJHgP1Etu4RqnLDxF5), page **Doen, Durven** (version `1794588444-dabe`)
- Artboard source: [doen-durven_final/](doen-durven_final/)
- Flow: canvas page *Flows*, "Flow 3 · Doen, Durven of de Waarheid turn"
- Drawn in Dutch; the English copy is in the tables below. The English title is an [open question](README.md#open-questions); the tables use "Truth or Dare".

Example data: room `K7Q 4MR`, host Lotte, 6 players in join order Lotte, Noor, Daan, Mila, Jesse, Sam. Levels Familie and Feest. Round 3; Lotte is up, Noor is next.

Copy keys are suggestions for `packages/core/src/i18n/{en,nl}/games/truthOrDare.ts`. `{x}` is a `fmt` placeholder; `{n|one|other}` a `plural`.

## Turn model

1. **Pick.** The active player chooses Doen, Durven or Waarheid. Everyone else sees who is choosing and the turn order.
2. **Prompt.** The server draws an unused prompt of that category from the room's levels, fills in a named player where the prompt has one (never the active player), and shows it on every phone.
3. **Done or skip.** The active player taps **Gedaan** or **Overslaan**. The host can do it for them. Skipping is always allowed and never penalised.
4. **Next player.** In join order, or random if the host chose it (random never picks the same player twice in a row). A round ends when everyone has had a turn. In random order the turn order is reshuffled at the start of each round (the first pick of a round is never the last player of the round before).
5. The game runs until the host ends it from the menu, the prompts run out, or fewer than 2 players (watchers don't count) are left in the rotation. Then everyone sees the summary.
6. Players leaving: a player who leaves is taken out of the rotation. If it was their turn, the next player is up. If they were the pre-drawn next player, the next player is drawn again. If they are named in the prompt on screen, the prompt stays as drawn and only their "you're in this one" line goes. A prompt that names a player is drawn only when someone other than the active player is in the rotation.

No timer, no points. Prompts never repeat within a game. If a category runs out for the room's levels, it is disabled on the pick screen with the hint "No prompts left" / "Geen opdrachten meer"; if all three run out, the game ends with the summary.

Header on every in-game screen: 44px menu button; kicker "Doen, durven of de waarheid" in violet; meta "Ronde 3 · 6 spelers"; on the pick and waiting screens a level chip on the right (`violetDim` fill, violet text: "Familie, Feest").

| Key | en | nl |
| --- | --- | --- |
| `truth.kicker` | Truth or dare | Doen, durven of de waarheid |
| `room.menuLabel` (aria) | Room menu | Kamermenu |
| `room.menu.hostTitle` (aria, host) | Host menu | Hostmenu |
| `truth.meta` | Round {round} · {n\|1 player\|{n} players} | Ronde {round} · {n\|1 speler\|{n} spelers} |
| `truth.levelList` | {levels} (joined with ", ") | {levels} |
| `truth.categories.do` | Do | Doen |
| `truth.categories.dare` | Dare | Durven |
| `truth.categories.truth` | Truth | Waarheid |

## 1. Pick · active player

`Truth-Pick.dc.html`.

Layout: "Lotte, jij bent aan de beurt" in violet, "Wat kies je?" at 34px, three category cards (84px tall, 22px name, hint, chevron), a footer line.

| State | What shows |
| --- | --- |
| `choosing` | Three enabled cards |
| `sending` | The tapped card gets a cyan border, `accentDim` fill, hint "Opdracht ophalen…" and a spinner (`aria-busy`); the other two dim to 45% and are disabled |
| `reconnecting` | Status strip "Verbinding herstellen… Je keuze wordt verstuurd zodra je weer online bent." Cards stay tappable; the pick queues |
| category exhausted | That card disabled at 45% with hint "Geen opdrachten meer" (not drawn) |

| Key | en | nl |
| --- | --- | --- |
| `truth.pick.you` | {name}, it's your turn | {name}, jij bent aan de beurt |
| `truth.pick.title` | What do you pick? | Wat kies je? |
| `truth.categories.doHint` | Carry out a task | Een opdracht uitvoeren |
| `truth.categories.dareHint` | Try something daring | Iets spannends wagen |
| `truth.categories.truthHint` | Answer honestly | Eerlijk antwoord geven |
| `truth.pick.loading` | Getting your prompt… | Opdracht ophalen… |
| `truth.pick.empty` | No prompts left | Geen opdrachten meer |
| `truth.pick.offline` | Reconnecting… Your pick is sent as soon as you're back online. | Verbinding herstellen… Je keuze wordt verstuurd zodra je weer online bent. |
| `truth.pick.footer` | Everyone will see your prompt · Next: {name} | Iedereen ziet straks je opdracht · Hierna: {name} |

## 2. Pick · everyone else

`Truth-Waiting.dc.html`.

Layout: an 88px avatar with a violet ring and the active player's initial; "Lotte kiest…" (`role="status"`); a pulse dot with "Doen, durven of de waarheid?"; the turn order card at the bottom (active player tagged "Nu" in violet, the next one "Hierna", the viewer marked "(jij)").

| State | What shows |
| --- | --- |
| `choosing` | As above. Show the next four players; with more, the list ends at four. |
| `reconnecting` | Status strip "Verbinding herstellen…" |
| `host` | Under the avatar, a card like the watch screen's: `truth.waiting.hostHint` ("Reageert de telefoon van Lotte niet? Sla de beurt van Lotte over.") with **Overslaan** (`accentDim` pill, 44px, accessible name "Overslaan voor Lotte"). It counts as skipped (no category) and the next player is up; pending: disabled with spinner. |
| watcher | As `choosing` |
| late joiner | Lands here; appears at the end of the turn order |

| Key | en | nl |
| --- | --- | --- |
| `truth.waiting.hostHint` | Is {name}'s phone not responding? Skip {name}'s turn. | Reageert de telefoon van {name} niet? Sla de beurt van {name} over. |
| `truth.waiting.skipFor` (aria) | Skip for {name} | Overslaan voor {name} |
| `truth.wait.choosing` | {name} is choosing… | {name} kiest… |
| `truth.wait.question` | Do, dare or truth? | Doen, durven of de waarheid? |
| `truth.wait.order` | Turn order | Volgorde |
| `truth.wait.now` | Now | Nu |
| `truth.wait.next` | Next | Hierna |
| `room.you` | {name} (you) | {name} (jij) |
| `room.offline` | Reconnecting… | Verbinding herstellen… |

## 3. Prompt · active player

`Truth-Prompt.dc.html`.

Layout: the active player row (48px initial avatar, name, "koos Doen"); category kicker in violet with a level chip; the prompt at 32px Space Grotesk; "Iedereen ziet deze opdracht."; **Gedaan** (primary) and **Overslaan** (secondary); footer line.

| State | What shows |
| --- | --- |
| `familie` | Doen · Familie: "Laat Noor je kapsel opnieuw stylen, zonder kam of borstel." |
| `feest` | Durven · Feest: "Zing het refrein van een liedje naar keuze, fluisterend en met een heel serieus gezicht." |
| `18+` | Waarheid · 18+: "Met wie in deze kamer zou je het liefst op date gaan, en waarom?" (web only) |
| `longPrompt` | A prompt over 120 characters at 26px; it wraps, never truncates |
| `saving` | The tapped button disabled with a spinner and "Opslaan…"; the other button disabled (the same for Gedaan and Overslaan) |
| done by the host | The screen moves on as if the player tapped it; no extra notice |

Prompt examples are content, not copy; the real prompts come from the content pack (the `generate-game-content` skill, with the 18+ opt-in exception). A named player in a prompt is highlighted in violet on the watchers' screen.

| Key | en | nl |
| --- | --- | --- |
| `truth.prompt.picked` | picked {category} | koos {category} |
| `truth.prompt.everyone` | Everyone sees this prompt. | Iedereen ziet deze opdracht. |
| `truth.prompt.done` | Done | Gedaan |
| `truth.prompt.skip` | Skip | Overslaan |
| `truth.prompt.saving` | Saving… | Opslaan… |
| `truth.prompt.footer` | You can always skip · Next: {name} | Overslaan mag altijd · Hierna: {name} |
| `truth.levels.family` / `party` / `adult` (chip) | Family / Party / 18+ | Familie / Feest / 18+ |

## 4. Prompt · everyone else

`Truth-Watch.dc.html`.

Layout: the active player row with a pulse dot and "is bezig met Doen"; category kicker and level chip; the same prompt at 32px with the named player highlighted in violet; a line for the named player only ("Jij, Noor, doet mee in deze opdracht."); for the host, a card to finish the turn; a `violetDim` notice for the next player.

| State | What shows |
| --- | --- |
| `player` | Prompt and status only |
| watcher (spectator seat) | Same as `player`: prompt and status, no actions, never named in a prompt, never the next player |
| named in the prompt | Extra line under the prompt for that player |
| next player | Notice "Hierna ben jij aan de beurt. Je telefoon laat het zien." |
| `host` | Card: `truth.watch.hostHint` ("Reageert de telefoon van Lotte niet? Rond het af voor Lotte.") with **Gedaan** and **Overslaan** (`accentDim` pills, 44px; accessible names "Gedaan voor Lotte", "Overslaan voor Lotte") |
| host taps for the player | Buttons disabled with spinner while saving; then everyone moves on |

| Key | en | nl |
| --- | --- | --- |
| `truth.watch.doing` | is doing {category} | is bezig met {category} |
| `truth.watch.named` | You're in this one, {name}. | Jij, {name}, doet mee in deze opdracht. |
| `truth.watch.hostHint` | Is {name}'s phone not responding? Finish the turn for {name}. | Reageert de telefoon van {name} niet? Rond het af voor {name}. |
| `truth.watch.doneFor` (aria) | Done for {name} | Gedaan voor {name} |
| `truth.watch.skipFor` (aria) | Skip for {name} | Overslaan voor {name} |
| `truth.watch.youNext` | You're next. Your phone will show it. | Hierna ben jij aan de beurt. Je telefoon laat het zien. |

Copy change from the canvas: the drawn Dutch hint "Lotte's telefoon is weg of reageert niet?" uses a possessive whose spelling depends on the name (Lotte's, but Noors). The Dutch string avoids the possessive so it works for every name.

## 5. Game over

`Truth-Over.dc.html`.

Layout: a star tile in `violetDim`, "Dat was het!" at 38px, "Lotte heeft het spel beëindigd na 4 rondes."; three stat tiles (Rondes 4, Gedaan 21, Overgeslagen 3); a "Meest gekozen" card ("Waarheid, 11 keer"); actions.

| State | What shows |
| --- | --- |
| `host` | **Nog een keer** (same room and settings, new game, prompts used in this room stay excluded), **Niveaus aanpassen** (opens the settings in edit mode with the room kept; see [Changing levels after a game](room-and-join_final.md#changing-levels-after-a-game)), **Terug naar de arcade** |
| `player` | Same summary; notice "Lotte kan een nieuw spel starten. Blijf hier om mee te doen."; **Terug naar de arcade** |
| `restarting` | Nog een keer disabled with spinner "Opnieuw starten…" |
| tie for most picked | "Meest gekozen" lists both: "Doen en Waarheid, 8 keer" |
| ended because prompts ran out | Subline "De opdrachten zijn op na {n} rondes." |
| ended because too few players were left | Subline `truth.over.tooFew`; the host's actions as `host` (Nog een keer is disabled with `truth.lobby.need` until 2 players are in the room; the room stays joinable at game over, as between games) |
| prompts will repeat (every category is out for these levels in this room) | Host notice above **Nog een keer**: `truth.over.promptsReset`; Nog een keer resets the room's used prompts; **Niveaus aanpassen** stays |
| ended before anyone picked | Rondes 1, Gedaan 0, Overgeslagen 0; the "Meest gekozen" card is hidden |

Approved choice 6: no winner and no per-player score. Rondes counts the rounds started, including the one the game ended in.

| Key | en | nl |
| --- | --- | --- |
| `truth.over.title` | That's a wrap! | Dat was het! |
| `truth.over.endedBy` | {host} ended the game after {n\|1 round\|{n} rounds}. | {host} heeft het spel beëindigd na {n\|1 ronde\|{n} rondes}. |
| `truth.over.tooFew` | Too few players were left after {n\|1 round\|{n} rounds}. | Er waren te weinig spelers over na {n\|1 ronde\|{n} rondes}. |
| `truth.over.ranOut` | The prompts ran out after {n\|1 round\|{n} rounds}. | De opdrachten zijn op na {n\|1 ronde\|{n} rondes}. |
| `truth.over.rounds` | Rounds | Rondes |
| `truth.over.done` | Done | Gedaan |
| `truth.over.skipped` | Skipped | Overgeslagen |
| `truth.over.mostPicked` | Most picked | Meest gekozen |
| `truth.over.mostPickedValue` | {categories}, {n\|once\|{n} times} | {categories}, {n\|1 keer\|{n} keer} |
| `room.playAgain` | Play again | Nog een keer |
| `truth.over.changeLevels` | Change levels | Niveaus aanpassen |
| `truth.over.promptsReset` | Every prompt for these levels has been played here. A new game can repeat prompts. | Alle opdrachten voor deze niveaus zijn hier gespeeld. In een nieuw spel kunnen opdrachten terugkomen. |
| `truth.over.restarting` | Restarting… | Opnieuw starten… |
| `truth.over.waitForHost` | {host} can start a new game. Stay here to join in. | {host} kan een nieuw spel starten. Blijf hier om mee te doen. |
| `common.endScreen.backToArcade` (existing) | Back to arcade | Terug naar de arcade |

## 6. Menu

Not drawn for this game; reuse the Beat the Clock bottom sheet ([pause menu](beat-the-clock_final.md#8-pause-menu)) with these items. There is no clock, so there is no pause or skip-turn item; the host finishes a stuck turn from the waiting screen (while the player chooses) or the watch screen (once the prompt shows).

| Who | Items |
| --- | --- |
| Host | How to play · End game (danger, confirm) |
| Player | How to play · Leave room (danger, confirm) |

End game confirm: "End the game for everyone?" with body "Everyone sees the summary of this game." / "Iedereen ziet het overzicht van dit spel.", then **End game** and **Keep playing**. Leaving takes the player out of the rotation; if it was their turn (choosing or on the prompt), the turn counts as skipped and the next player is up. Server, landing and rejoin: [leaving a room](README.md#leaving-a-room).

| Key | en | nl |
| --- | --- | --- |
| `truth.end.body` | Everyone sees the summary of this game. | Iedereen ziet het overzicht van dit spel. |
| `room.menu.*`, `room.leave.*`, `room.end.*`, `room.howToPlay` | as in [Beat the Clock](beat-the-clock_final.md#8-pause-menu) | as there |

## How to play

| Key | en | nl |
| --- | --- | --- |
| `truth.howTo.1` | Take turns. On your turn, pick Do, Dare or Truth. | Je bent om de beurt. Kies als je aan de beurt bent Doen, Durven of Waarheid. |
| `truth.howTo.2` | Everyone sees your prompt. Do it, answer it, or skip it. | Iedereen ziet je opdracht. Voer hem uit, beantwoord hem of sla hem over. |
| `truth.howTo.3` | Tap Done or Skip when you're finished. Skipping is always fine. | Tik op Gedaan of Overslaan als je klaar bent. Overslaan mag altijd. |
| `truth.howTo.4` | The host ends the game whenever you like. There are no points. | De host beëindigt het spel wanneer jullie willen. Er zijn geen punten. |

## Not drawn, built to the overview

- Larger system text: [larger system text](README.md#larger-system-text). The prompt never truncates; the actions follow it at the end of the scroll.
- English copy for every screen: the tables above.
- The in-game menu, exhausted categories, a tie for most picked, and the host finishing a turn while saving: specified above.
