# Beat the Clock: final study

The in-game screens of Beat the Clock / Tegen de Klok, from the first turn to the winner. Hosting and the lobby are in [room and join](room-and-join_final.md); tokens, type, motion, accessibility, larger text and component bindings are in the [overview](README.md).

- Canvas: [Arcade Club party games](https://claude.ai/artifact/LnbzrJHgP1Etu4RqnLDxF5), page **Beat the Clock** (version `1794588444-dabe`)
- Artboard source: [beat-the-clock_final/](beat-the-clock_final/)
- Flow: canvas page *Flows*, "Flow 2 · Beat the Clock turn"
- Drawn in English; the Dutch copy is in the tables below.

Example data: room `K7Q 4MR`, 30 s turns, first to 30. Comets (Sam, Noor, Lotte) against Rockets (Daan, Mila, Jesse). Turn 7: Sam describes for Comets; Noor guesses; Rockets referee. Card: Lighthouse, Pancake, Volcano, Saxophone, Passport. Before the turn: Comets 18, Rockets 21.

Copy keys are suggestions for `packages/core/src/i18n/{en,nl}/games/beatTheClock.ts`. `{x}` is a `fmt` placeholder; `{n|one|other}` a `plural` (in code `plural()` fills `{count}`). Team names are localized (Comets/Kometen, Rockets/Raketten; full list in [room and join](room-and-join_final.md#3-lobby--host)).

## Turn model

1. **Ready.** The next team plays; within it, the next describer in rotation. The describer sees **Go**; everyone else waits. No time runs.
2. **Describing.** Go starts the timer on the server. The describer sees the 5 words and ticks each one guessed; teammates see the timer and the count; opponents see the card with live ticks. Ticks save as they happen.
3. **Time's up** (or **End turn early**). The describer may untick a mis-tap, then sends. Sending is required to move on; if the describer doesn't send within 10 s after time runs out, the ticks as they stand are sent automatically.
4. **Referee check.** Opponents see the ticked words and can flag any of them. The first opponent to tap **Confirm** ends the check for everyone; otherwise it confirms itself 10 s after the send. Flagged words don't count.
5. **Turn score.** +1 per counted word. Everyone sees the scoreboard and who describes next.
6. Content: each turn needs 5 words not yet used in this game. If fewer than 5 are left when a turn starts, the game ends with the current scores (winner screen, `clock.winner.ranOut`).
7. After the last team's turn in a round: if any team is at or above the target, the highest score wins; a tie at the top plays one more round with every team. Otherwise the next round starts.

The server owns the clock (start time and length); phones render the countdown from it, so a reload or reconnect shows the right time. The clock keeps running if the describer drops; they rejoin into the same turn with their ticks.

Header on every in-game screen: 44px pause button (`aria-label` "Pause") that opens the menu (screen 8); kicker "Beat the Clock" in amber; meta line "Turn 7 · first to 30"; "Room K7Q 4MR" on the right. A scoreboard strip sits at the bottom of the describer, teammate and opponent screens: the playing team's card has an amber border and shows the pending gain ("18 +2"). With 2 teams it is two columns; with 3 or 4 it is a 2 × 2 grid, playing team first, then the others in turn order.

**3 or 4 teams.** One team plays; every other team referees. Wherever the copy below says `{opponents}` or a referee `{team}`, it is the list of all other teams, joined by the list helper in the [overview](README.md#component-bindings) ("Rockets and Meteors" / "Raketten en Meteoren"). The opponent and referee screens (3, 4) are shown to every player of every other team; any of them can flag and confirm.

| Key | en | nl |
| --- | --- | --- |
| `clock.title` | Beat the Clock | Tegen de Klok |
| `clock.pause` (aria) | Pause | Pauze |
| `clock.meta.turn` | Turn {turn} · first to {target} | Beurt {turn} · eerst bij {target} |
| `clock.meta.check` | Turn {turn} · referee check | Beurt {turn} · controle |
| `room.roomCode` | Room {code} | Kamer {code} |
| `clock.scoreGain` | +{n} | +{n} |

## 1. Turn · describer

`Clock-Describer.dc.html`.

| State | What shows |
| --- | --- |
| `ready` | Team chip "Comets", "Your turn to describe", how-to text; **Go** as the cyan primary at 64px tall with a 20px label (the game hue is never a button fill). Words are not on the screen or in the client state yet. |
| `describing` | Timer 96px amber with "seconds left" and a 6px amber time bar; hint line; 5 word rows (60px, number, word 21px, check circle); "{n} of 5 guessed" and **End turn early** |
| last 5 s | Timer and bar turn `danger`; label "Last seconds" |
| `timeUp` | Timer 0:00 in `danger`, label "Time's up"; hint changes; ticked rows can be unticked (approved choice 2: undo a wrong tick), unticked rows can no longer be ticked; **Send {n} words to Rockets** replaces the footer |
| sending | Send button disabled with spinner "Sending…" (pending state; not drawn) |
| `reconnecting` | Status strip "Reconnecting… The clock keeps running. Your ticks are saved." |

Word row: untapped = transparent row with an outlined circle; ticked = `amberDim` row with a filled amber circle and a check in `onAmber`, `aria-pressed="true"`. Tapping toggles. After the check starts, rows are read-only.

**End turn early** sends straight away without a confirm; it is a quiet text action so it isn't hit by accident.

| Key | en | nl |
| --- | --- | --- |
| `clock.describer.readyTitle` | Your turn to describe | Jij omschrijft |
| `clock.describer.readyBody` | Describe each word without saying it. {guessers} guesses; {opponents} watch as referee. The 5 words appear when you tap Go. | Omschrijf elk woord zonder het te zeggen. {guessers} raadt; {opponents} kijken mee als scheidsrechter. De 5 woorden verschijnen als je op Start tikt. |
| `clock.go` | Go | Start |
| `clock.timer.left` | seconds left | seconden over |
| `clock.timer.last` | Last seconds | Laatste seconden |
| `clock.timer.up` | Time's up | Tijd is op |
| `clock.timer.bar` (aria) | Time left | Resterende tijd |
| `clock.timer.announce10` (live region) | 10 seconds left | Nog 10 seconden |
| `clock.timer.announce5` (live region) | 5 seconds left | Nog 5 seconden |
| `clock.describer.hint` | You describe · tap a word when it's guessed | Jij omschrijft · tik een woord aan als het geraden is |
| `clock.describer.hintUp` | Fix a mis-tap, then send. {opponents} check the words next. | Verbeter een verkeerde tik en verstuur. Daarna controleren {opponents} de woorden. |
| `clock.guessedCount` | {n} of 5 guessed | {n} van 5 geraden |
| `clock.describer.endEarly` | End turn early | Beurt nu beëindigen |
| `clock.describer.send` | Send {n\|1 word\|{n} words} to {opponents} | {n\|1 woord\|{n} woorden} naar {opponents} sturen |
| `clock.describer.sending` | Sending… | Versturen… |
| `clock.describer.offline` | Reconnecting… The clock keeps running. Your ticks are saved. | Verbinding herstellen… De klok loopt door. Je vinkjes zijn bewaard. |

`{guessers}` lists the teammates ("Noor", "Noor and Lotte" / "Noor en Lotte"). With more than one guesser use the plural-verb variant:

| Key | en | nl |
| --- | --- | --- |
| `clock.describer.readyBodyMany` | Describe each word without saying it. {guessers} guess; {opponents} watch as referee. The 5 words appear when you tap Go. | Omschrijf elk woord zonder het te zeggen. {guessers} raden; {opponents} kijken mee als scheidsrechter. De 5 woorden verschijnen als je op Start tikt. |

## 2. Turn · teammate

`Clock-Teammate.dc.html`. The guessing team's other players.

| State | What shows |
| --- | --- |
| `ready` | Team chip with "Your team · Sam describes"; a pulse dot, "Get ready to guess", "The clock starts when Sam taps Go. Put your phone down and listen." |
| `describing` | Timer 136px, time bar, "Guess out loud", 5 progress dots (filled amber per ticked word, `role="img"` with label "2 of 5 words guessed"), "2 of 5 guessed". No words. |
| last 5 s | Timer and bar turn `danger`, and the label "Last seconds" (`clock.timer.last`, 14px 600 `textMuted`) appears directly under the timer, above the bar, so colour is never the only signal (approved choice 4) |
| `timeUp` | Timer 0:00 in `danger`, label "Time's up" (`clock.timer.up`); the dots and count freeze but follow the describer's unticks; "Waiting for Sam to send the words" (`clock.waitSend`). Still no words. |
| `reconnecting` | Strip "Reconnecting… Keep guessing out loud." |

When the describer sends (or the 10 s auto-send fires), teammates move to the describing team's check screen (screen 5).

| Key | en | nl |
| --- | --- | --- |
| `clock.teammate.team` | Your team · {describer} describes | Jouw team · {describer} omschrijft |
| `clock.teammate.readyTitle` | Get ready to guess | Maak je klaar om te raden |
| `clock.teammate.readyBody` | The clock starts when {describer} taps Go. Put your phone down and listen. | De klok start als {describer} op Start tikt. Leg je telefoon neer en luister. |
| `clock.teammate.guess` | Guess out loud | Raad hardop |
| `clock.teammate.dots` (aria) | {n} of 5 words guessed | {n} van 5 woorden geraden |
| `clock.teammate.offline` | Reconnecting… Keep guessing out loud. | Verbinding herstellen… Blijf hardop raden. |

## 3. Turn · opponent

`Clock-Opponent.dc.html`. Every player of the other team(s).

| State | What shows |
| --- | --- |
| `ready` | Timer 0:30 at 64px; "Comets are up", "Waiting for Sam to tap Go"; referee notice; a placeholder "The card appears when Sam taps Go." |
| `describing` | Timer counting; "Comets are describing", "Sam describes, Noor guesses"; referee notice; the card as a read-only list, ticked words with `amberDim` fill and the text "Guessed" |
| last 5 s | Timer turns `danger`, and "Last seconds" (`clock.timer.last`, 14px 600 `textMuted`) appears directly under the timer, replacing the sub line for those seconds (approved choice 4) |
| `timeUp` | Timer 0:00 in `danger`, label "Time's up" (`clock.timer.up`) replacing the sub line; "Waiting for Sam to send the words" (`clock.waitSend`); the card stays read-only and shows unticks live; no Flag. The check (screen 4) starts when the words are sent. |
| `reconnecting` | Strip "Reconnecting… Ticks may show a moment late." |

Opponents cannot flag during the turn (approved choice 3). Scoreboard at the bottom shows "Rockets · you" on their own team.

| Key | en | nl |
| --- | --- | --- |
| `clock.opponent.upTitle` | {team} are up | {team} zijn aan de beurt |
| `clock.opponent.upBody` | Waiting for {describer} to tap Go | Wachten tot {describer} op Start tikt |
| `clock.opponent.busyTitle` | {team} are describing | {team} zijn aan het omschrijven |
| `clock.opponent.busyBody` | {describer} describes, {guessers} guesses | {describer} omschrijft, {guessers} raadt |
| `clock.opponent.referee` | You're referee. Listen for {describer} saying a word on the card. You can flag it after the turn. | Jij bent scheidsrechter. Let op of {describer} een woord van de kaart zegt. Na de beurt kun je het markeren. |
| `clock.opponent.cardSoon` | The card appears when {describer} taps Go. | De kaart verschijnt als {describer} op Start tikt. |
| `clock.opponent.card` (aria) | {team}' card | Kaart van {team} |
| `clock.opponent.guessed` | Guessed | Geraden |
| `clock.opponent.yourTeam` | {team} · you | {team} · jij |
| `clock.waitSend` | Waiting for {describer} to send the words | Wachten tot {describer} de woorden verstuurt |
| `clock.opponent.offline` | Reconnecting… Ticks may show a moment late. | Verbinding herstellen… Vinkjes kunnen iets later verschijnen. |

With several guessers use the plural-verb variant:

| Key | en | nl |
| --- | --- | --- |
| `clock.opponent.busyBodyMany` | {describer} describes, {guessers} guess | {describer} omschrijft, {guessers} raden |

## 4. Referee check · opponent

`Clock-Referee.dc.html`.

Layout: title and explanation; the ticked words, each with a **Flag** button; a "Not guessed" list (muted, no actions); the auto-confirm line; **Confirm {n} words**.

| State | What shows |
| --- | --- |
| `checking` | All ticked words with **Flag**; countdown "Counts on its own in 8 s." (live, from the server's send time + 10 s) |
| `oneFlagged` | Flagged row: `dangerDim` fill, word struck through, "Flagged · won't count", button **Undo**; the confirm label and points drop by one |
| `sending` | Confirm disabled with spinner "Confirming…"; flag buttons disabled |
| `confirmedByOther` | Buttons gone; status "Mila confirmed. Comets score 2 points." Then everyone moves to the score. |
| no ticked words | Title stays; list reads "No words to check."; **Confirm 0 words** still ends the check (not drawn) |

Flags are shared: a flag by Mila shows on Daan's screen too, and either can undo it. Only the confirm ends the check.

| Key | en | nl |
| --- | --- | --- |
| `clock.check.title` | Check {team}' words | Controleer de woorden van {team} |
| `clock.check.body` | Flag a word if {describer} said it, or part of it. A flagged word doesn't count. | Markeer een woord als {describer} het zei, of een deel ervan. Een gemarkeerd woord telt niet. |
| `clock.check.flag` | Flag | Markeer |
| `clock.check.flagAria` | Flag {word} | Markeer {word} |
| `clock.check.undo` | Undo | Herstel |
| `clock.check.undoAria` | Unflag {word} | Markering van {word} weghalen |
| `clock.check.flagged` | Flagged · won't count | Gemarkeerd · telt niet |
| `clock.check.missed` | Not guessed | Niet geraden |
| `clock.check.none` | No words to check. | Geen woorden om te controleren. |
| `clock.check.auto` | Counts on its own in {s} s. Any referee can flag. | Telt vanzelf over {s} s. Elke scheidsrechter kan markeren. |
| `clock.check.confirm` | Confirm {n\|1 word\|{n} words} | {n\|1 woord\|{n} woorden} bevestigen |
| `clock.check.confirming` | Confirming… | Bevestigen… |
| `clock.check.confirmedBy` | {name} confirmed. {team} score {n\|1 point\|{n} points}. | {name} heeft bevestigd. {team} krijgen {n\|1 punt\|{n} punten}. |

## 5. Referee check · describing team

`Clock-Checking.dc.html`. The describer and teammates while the opponents check.

| State | What shows |
| --- | --- |
| `waiting` | Status "Counts on its own in 8 s"; "Rockets are checking your words"; the ticked words with "Checking"; "This turn +3"; footer "Nothing to do. Scores show when Rockets confirm, or after 10 s." |
| `flagged` | The flagged word struck through in a `dangerDim` row with "Flagged by Mila"; "+2" |
| `confirmed` | "Rockets confirmed your words", rows read "Counts", **See the scores** (everyone also moves automatically after 2 s) |

| Key | en | nl |
| --- | --- | --- |
| `clock.checking.title` | {team} are checking your words | {team} controleren jullie woorden |
| `clock.checking.done` | {team} confirmed your words | {team} hebben jullie woorden bevestigd |
| `clock.checking.auto` | Counts on its own in {s} s | Telt vanzelf over {s} s |
| `clock.checking.confirmed` | Confirmed | Bevestigd |
| `clock.checking.list` (aria) | Your guessed words | Jullie geraden woorden |
| `clock.checking.pending` | Checking | Wordt gecontroleerd |
| `clock.checking.counts` | Counts | Telt |
| `clock.checking.flaggedBy` | Flagged by {name} | Gemarkeerd door {name} |
| `clock.checking.thisTurn` | This turn | Deze beurt |
| `clock.checking.seeScores` | See the scores | Bekijk de stand |
| `clock.checking.footer` | Nothing to do. Scores show when {team} confirm, or after 10 s. | Je hoeft niets te doen. De stand verschijnt als {team} bevestigen, of na 10 s. |

## 6. Turn score

`Clock-Score.dc.html`. Everyone.

Layout: "+2" large in amber with "for Comets" and a detail line; the scoreboard as rows (team, score, a progress bar to the target, leader with an amber border); the next-turn card at the bottom.

| State | What shows |
| --- | --- |
| `nextTurn` | "+2 for Comets", "3 guessed, 1 flagged by Rockets"; Rockets 21, Comets 20; card "Next: Daan describes for Rockets. Daan's screen shows Go when it's time." |
| `youreNext` (the next describer) | Card "You're next. Describe for Rockets. Take your phone, then tap Next." with **Next** (goes to the describer's ready state) |
| `targetHitTie` (round ends with a tie at the top, at or above the target) | "Round 4 is complete, and Rockets and Comets are tied at 31." (`clock.score.roundDoneTie`); **See who won** opens the winner `tie` state |
| `targetHit` (end of a round with a team at or above the target) | Meta "Round 4 complete · first to 30"; "+4 for Rockets", "Round 4 is complete, and Rockets reached 30."; Rockets 31, Comets 28; **See who won** |
| 3 or 4 teams | One row per team, sorted by score; the leader has the amber border |
| target passed mid-round | Normal `nextTurn`; the round finishes first (rule 1) |

Progress bars: `role="progressbar"`, max = target, label "{team} progress to {target}". The score screen stays until the next describer taps Next (or Go); there is no timer.

| Key | en | nl |
| --- | --- | --- |
| `clock.score.gain` | +{n} | +{n} |
| `clock.score.for` | for {team} | voor {team} |
| `clock.score.detail` | {n} guessed, {f} flagged by {opponents} | {n} geraden, {f} gemarkeerd door {opponents} |
| `clock.score.detailNoFlags` | {n} guessed | {n} geraden |
| `clock.score.roundDoneTie` | Round {round} is complete, and {teams} are tied at {score}. | Ronde {round} is klaar en {teams} staan gelijk op {score}. |
| `clock.score.roundDone` | Round {round} is complete, and {team} reached {target}. | Ronde {round} is klaar en {team} zitten op of boven de {target}. |
| `clock.meta.roundDone` | Round {round} complete · first to {target} | Ronde {round} klaar · eerst bij {target} |
| `clock.score.list` (aria) | Scores | Stand |
| `clock.score.progress` (aria) | {team} progress to {target} | {team} op weg naar {target} |
| `clock.score.youNext` | You're next. | Jij bent hierna. |
| `clock.score.youNextBody` | Describe for {team}. Take your phone, then tap Next. | Omschrijf voor {team}. Pak je telefoon en tik op Volgende. |
| `clock.score.next` | Next | Volgende |
| `clock.score.nextName` | Next: {name} | Hierna: {name} |
| `clock.score.nextBody` | describes for {team}. | omschrijft voor {team}. |
| `clock.score.nextHint` | {name}'s screen shows Go when it's time. | {name} ziet Start op het scherm zodra het zover is. |
| `clock.score.seeWinner` | See who won | Bekijk wie er won |

## 7. Winner

`Clock-Winner.dc.html`.

Layout: trophy tile in `amberDim`, headline 40px, a subline; final scores as ranked rows (place, team, players, score; winner with an amber border); actions.

| State | What shows |
| --- | --- |
| `host` | "Rockets win", "31 to 28 after 4 rounds. Mila described the most words."; **Play again** (same teams and settings, new game; words used in this room stay excluded), **New teams** (back to the lobby with teams cleared), **Back to arcade** |
| `player` | Same result; instead of the host actions a notice "Sam can start a new game. Stay here to play again."; **Back to arcade** |
| `tie` | "Tied at 31", "One more round decides it. Every team gets one more turn."; places show "="; **Start the extra round** for everyone (it goes to the next turn's score/ready state); no other actions |
| `endedEarly` | Meta line says why: `clock.winner.endedByHost`, `clock.winner.tooFewTeams` or `clock.winner.ranOut`; otherwise as `host` / `player` |
| `endedTie` (game ended early, or the pack ran out, with a tie at the top) | Title `clock.winner.tieTitle` ("Tied at 31"), body `clock.winner.endedTieBody`, meta as `endedEarly`; places show "="; the normal `host` / `player` actions, no extra round |
| Play again blocked (a team has fewer than 2 players) | **Play again** disabled with `clock.lobby.need` under it; **New teams** stays |
| pack will repeat (fewer than 5 unused words left in this room) | Host notice above Play again: `clock.winner.packReset`; Play again resets the room's used words |
| restarting (host tapped Play again) | Play again disabled with spinner "Starting…" (pending state; not drawn) |

Copy change from the canvas: the artboard's "Mila guessed the most words" becomes "described". The "most words" line names the describer whose turns produced the most counted words (guesses are spoken, so only describing is tracked per player); omit the sentence on a tie between players. With 3 or 4 teams the subline uses `clock.winner.bodyMany` (the winning score only) and the rows list every team by place.

| Key | en | nl |
| --- | --- | --- |
| `clock.winner.meta` | Game over | Spel voorbij |
| `clock.winner.metaTie` | Round {round} complete | Ronde {round} klaar |
| `clock.winner.title` | {team} win | {team} winnen |
| `clock.winner.body` | {a} to {b} after {n\|1 round\|{n} rounds}. | {a} tegen {b} na {n\|1 ronde\|{n} rondes}. |
| `clock.winner.bodyMany` | {score} points after {n\|1 round\|{n} rounds}. | {score} punten na {n\|1 ronde\|{n} rondes}. |
| `clock.winner.best` | {name} described the most words. | {name} omschreef de meeste woorden. |
| `clock.winner.tieTitle` | Tied at {score} | Gelijk op {score} |
| `clock.winner.tieBody` | One more round decides it. Every team gets one more turn. | Eén extra ronde beslist. Elk team krijgt nog één beurt. |
| `clock.winner.endedTieBody` | The game ended in a tie after {n\|1 round\|{n} rounds}. | Het spel eindigde gelijk na {n\|1 ronde\|{n} rondes}. |
| `clock.winner.endedByHost` | {host} ended the game | {host} heeft het spel beëindigd |
| `clock.winner.tooFewTeams` | Too few teams could still play | Te weinig teams konden nog spelen |
| `clock.winner.ranOut` | The word pack ran out | De woordenlijst is op |
| `clock.winner.packReset` | Every word in this pack has been used here. A new game can repeat words. | Alle woorden uit deze lijst zijn hier gebruikt. In een nieuw spel kunnen woorden terugkomen. |
| `clock.winner.list` (aria) | Final scores | Eindstand |
| `clock.winner.extraRound` | Start the extra round | Start de extra ronde |
| `room.playAgain` | Play again | Nog een keer |
| `clock.winner.newTeams` | New teams | Nieuwe teams |
| `room.waitForHost` | {host} can start a new game. Stay here to play again. | {host} kan een nieuw spel starten. Blijf hier om weer mee te doen. |
| `common.endScreen.backToArcade` (existing) | Back to arcade | Terug naar de arcade |

## 8. Pause menu

`Clock-Pause.dc.html`. Opens from the pause button on any in-game screen, as a bottom sheet over a dimmed game.

| State | What shows |
| --- | --- |
| `player` | Title "Menu"; How to play · Switch team ("From the next turn") · Leave room ("You can rejoin with code K7Q 4MR", in `danger`) |
| `host` | Title "Host menu"; Pause for everyone ("Stops the clock on every phone") · Skip this turn ("No points; Rockets go next") · How to play · End game ("Shows the scores as final", in `danger`) |
| `hostConfirmEnd` | `alertdialog` "End the game for everyone?" with body, **End game** (`danger` fill, `onDanger` ink) and **Keep playing** |
| `pausedByHost` (players) | No sheet; a centred "Paused" card over the dimmed game: "Sam paused the game. The clock is stopped at 0:17 and starts again when Sam resumes." The describer's words are hidden behind it until the clock runs again. |
| paused (host) | The first host item reads **Resume for everyone** ("Starts the clock on every phone"); not drawn |

Behaviour:

- Opening the menu does not stop the clock for anyone. Only **Pause for everyone** does.
- Pause freezes the phase that is running: the turn clock, the 10 s auto-send after time's up, or the 10 s referee check (its countdown stops and Confirm is disabled). On the ready screen Go is disabled; on the score screen the move to the next turn waits. Resume continues from the frozen value.
- **Skip this turn**: no points for the playing team; the next team plays. No confirm (it is reversible in effect: the team plays again next round).
- **Switch team**: opens the team picker from the player lobby (screen 5 of room and join); applies from the next turn. Hidden for the current describer during their turn. Disabled, with the hint `clock.menu.switchBlocked`, when your team would drop below 2 players.
- **Leave room**: leaves the seat after a confirm ("Leave the room?" / "Kamer verlaten?", body "You can rejoin with code {code}." / "Je kunt terugkomen met code {code}.", buttons **Leave** / **Verlaten** and **Stay** / **Blijven**). A team that drops below 2 players has its turns skipped until it has 2 again (a player switches in); every phone shows `clock.turn.skippedShort` for 3 s instead of the ready screen. If fewer than 2 teams have 2 players, the game ends with the current scores (`clock.winner.*`, as **End game**).
- **End game**: after confirm, the current turn doesn't count and everyone goes to the winner screen with the current scores (a tie shows `endedTie`, without an extra round).
- **How to play**: the game's how-to steps (as `RoomFrame`'s `howToPlay`).
- Close: the × button (`aria-label` "Close menu"), the scrim, Escape, or system back.

| Key | en | nl |
| --- | --- | --- |
| `room.menu.title` | Menu | Menu |
| `room.menu.hostTitle` | Host menu | Hostmenu |
| `room.menu.close` (aria) | Close menu | Menu sluiten |
| `clock.menu.pause` | Pause for everyone | Pauzeer voor iedereen |
| `clock.menu.pauseHint` | Stops the clock on every phone | Zet de klok op elke telefoon stil |
| `clock.menu.resume` | Resume for everyone | Verder voor iedereen |
| `clock.menu.resumeHint` | Starts the clock on every phone | Laat de klok op elke telefoon weer lopen |
| `clock.menu.skip` | Skip this turn | Sla deze beurt over |
| `clock.menu.skipHint` | No points; {team} go next | Geen punten; {team} zijn hierna |
| `room.howToPlay` | How to play | Zo speel je |
| `room.menu.end` | End game | Spel beëindigen |
| `clock.menu.endHint` | Shows the scores as final | De huidige stand wordt de eindstand |
| `clock.menu.switch` | Switch team | Wissel van team |
| `clock.menu.switchHint` | From the next turn | Vanaf de volgende beurt |
| `clock.menu.switchBlocked` | Your team needs at least 2 players | Je team heeft minstens 2 spelers nodig |
| `clock.turn.skippedShort` | {team} have too few players, so their turn is skipped. | {team} hebben te weinig spelers, dus hun beurt wordt overgeslagen. |
| `room.menu.leave` | Leave room | Kamer verlaten |
| `room.menu.leaveHint` | You can rejoin with code {code} | Je kunt terugkomen met code {code} |
| `room.leave.title` | Leave the room? | Kamer verlaten? |
| `room.leave.body` | You can rejoin with code {code}. | Je kunt terugkomen met code {code}. |
| `room.leave.confirm` | Leave | Verlaten |
| `room.leave.cancel` | Stay | Blijven |
| `clock.paused.title` | Paused | Gepauzeerd |
| `clock.paused.body` | {host} paused the game. The clock is stopped at {time} and starts again when {host} resumes. | {host} heeft het spel gepauzeerd. De klok staat stil op {time} en loopt weer als {host} verdergaat. |
| `room.end.title` | End the game for everyone? | Spel beëindigen voor iedereen? |
| `clock.end.body` | This turn won't count. Everyone sees the current scores as final: {scores}. | Deze beurt telt niet. Iedereen ziet de huidige stand als eindstand: {scores}. |
| `room.end.confirm` | End game | Spel beëindigen |
| `room.end.cancel` | Keep playing | Verder spelen |

`{scores}` is "Rockets 21, Comets 18" (highest first, joined with ", "). `room.menu.*` is the menu's key group; the menu button's accessible name is `room.menuLabel` (room and join) or `clock.pause`.

## How to play

Shown from the menu and in the lobby's how-to panel.

| Key | en | nl |
| --- | --- | --- |
| `clock.howTo.1` | Split into teams. Teams take turns; each turn one player describes. | Verdeel jullie in teams. De teams zijn om de beurt; per beurt omschrijft één speler. |
| `clock.howTo.2` | The describer taps Go and sees 5 words. Describe them without saying the word or part of it. | De omschrijver tikt op Start en ziet 5 woorden. Omschrijf ze zonder het woord of een deel ervan te zeggen. |
| `clock.howTo.3` | Your team guesses out loud. Tap each word they get before the clock runs out. | Je team raadt hardop. Tik elk geraden woord aan voordat de tijd op is. |
| `clock.howTo.4` | The other team checks the words and can flag one you said. Each word that counts is 1 point. | Het andere team controleert de woorden en kan een woord markeren dat je zei. Elk woord dat telt is 1 punt. |
| `clock.howTo.5` | After a full round, the highest team at or above the target wins. | Na een volle ronde wint het hoogste team dat op of boven het doel zit. |

## Not drawn, built to the overview

- Larger system text: [larger system text](README.md#larger-system-text). The describer's word list scrolls under the timer; the timer stays visible.
- Dutch copy for every screen: the tables above.
- Pending states for Send and Play again, the host's paused menu, the empty check and the leave confirm: specified in the state tables above.
