# Game Additions Research And AI Prompt Brief

Date: 2026-07-03

Project: Arcade Club

Purpose: identify which games are worth adding next, why they fit this product, what "must have" functionality each game needs, and how to prompt an AI implementation agent with measurable outcomes.

## Executive Summary

Arcade Club already has the right foundation for a broad browser games platform: reusable game sessions, room codes, QR/share links, guest participation, Convex real-time state, and separate join modes for rooms, challenges, and solo play. The best next games should compound that foundation instead of requiring an entirely new platform.

The strongest additions are not graphics-heavy games. The best fit is a mix of:

1. Daily/solo puzzle games that create repeat visits.
2. Room-based party games where every player uses a phone.
3. Lightweight direct challenge games that can be played from a link.
4. Low-asset abstract board/card games with deterministic rules and good tests.

Recommended build order:

| Rank | Game | Working product name | Mode | Why it should be next |
| ---: | --- | --- | --- | --- |
| 1 | Connections-style category puzzle | Word Links | Solo + room race | High market proof, low asset cost, strong AI generation fit, already matches "word-games" placeholder. |
| 2 | Codenames-style team clue game | Signal Words | Room/team | Excellent social fit, low UI complexity, strong group play, proven tabletop demand. |
| 3 | Drawing telephone / Drawful-like party game | Sketch Relay | Room | High laughter/social sharing, uses phones naturally, fills a missing creative party category. |
| 4 | Chess | Chess | Challenge + async | Already in catalog, enormous demand, clear rules engine path, helps establish serious two-player play. |
| 5 | Liar's Dice / bluff dice | Bluff Dice | Room/challenge | Fast, suspenseful, simple state model, works for 2-8 players. |
| 6 | Social deduction lite | The Mole Table | Room | Strong party demand, minimal assets, good replay, but needs careful UX and moderation tools. |
| 7 | Cooperative deduction logic | Fuse Team | Room/co-op | Differentiates from pure competition and uses table talk well. |
| 8 | Word tile duel | Letter Duel | Challenge + async | Proven word-game demand, good retention, but requires dictionary/rating work. |
| 9 | Quick classics bundle | Connect Four, Reversi, Checkers | Challenge | Fast implementation wins; useful for platform polish and matchmaking later. |
| 10 | Geo/photo guessing | Place Guess | Solo + room | Strong concept, but map/photo licensing and content sourcing make it riskier. |

Avoid building large licensed-style board games first, such as Catan-like trading, Ticket-to-Ride-like route claiming, or full campaign games. They are attractive but have much higher rules, UX, AI, and IP/trade-dress risk. Build them only after the platform has analytics, rematches, invitations, and reliable multi-seat state.

## Research Basis

### Market And Product Signals

1. Browser and mobile-friendly games remain commercially meaningful. Newzoo estimated the global games market at about $197B for 2025, with PC and mobile outperforming earlier forecasts. This matters because Arcade Club is web-first and can succeed without console-grade production if the game loop is strong. Source: PC Gamer summary of Newzoo's 2025 market update: https://www.pcgamer.com/gaming-industry/analyst-firm-says-the-games-market-is-expected-to-reach-a-record-breaking-usd197-billion-by-the-end-of-2025-driven-primarily-by-stronger-than-expected-performance-on-pc-and-mobile/

2. Daily puzzles are a proven habit loop. NYT Games reported 11.1B puzzle plays in 2024, including 5.3B Wordle plays, 3.3B successful Connections solves, and 1.3B Strands plays. That strongly supports adding a daily puzzle layer and not only live party games. Source: The Verge on NYT Crossplay and puzzle stats: https://www.theverge.com/games/682063/the-new-york-times-nyt-games-crossplay-scrabble-pips

3. NYT's games strategy emphasizes high-quality, non-addictive, human-curated puzzles that fit into daily routines. Arcade Club can copy the product lesson without copying the games: short sessions, shareable results, streaks, archives, and quality gates matter. Source: Axios interview with NYT Games: https://www.axios.com/2024/01/29/wordle-nyt-games-news-media-layoffs

4. Online board games are validated at web scale. Board Game Arena passed 10M user accounts, had 900+ games, and reported about 5M hours played each month in 2024. It also grew because anyone with a browser could play. Source: GamesBeat: https://gamesbeat.com/board-game-arena-surpasses-10m-user-account-milestone/

5. Chess remains a massive evergreen two-player game. Chess.com's public members page showed over 268M members on 2026-07-03, with hundreds of thousands online at the time the page was checked. Source: https://www.chess.com/members

6. Party games where phones are controllers are a strong platform fit. The Jackbox Party Pack model uses one shared host screen, room codes, phones/tablets as controllers, voting, drawing, writing, and audience participation. Arcade Club already has room codes, host/player routes, and QR sharing, so this pattern is directly reusable. Reference: https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack

7. Codenames proves that lightweight word/team mechanics can become mainstream. The Guardian reported 15M Codenames units sold in nine years, citing its simple rules and deep social interpretation as core appeal. Source: https://www.theguardian.com/culture/2024/sep/26/vlaada-chvatil-codenames-board-game-market-czech-phone

8. AI can help generate word association puzzles, but quality control is mandatory. A 2024 arXiv paper found LLMs can generate enjoyable, challenging Connections-style puzzles when prompted with structured methods, while the task remains difficult because it requires modeling solver reasoning. Source: https://arxiv.org/abs/2407.11240

9. Geo guessing is attractive but content/licensing is a serious product constraint. GeoGuessr built a long-running browser game around location guessing, later adding competitive modes and ranked play, but it depends on Google Street View-like data and paid access limits. Arcade Club should only attempt this with a license-safe media strategy. Source: https://www.theverge.com/news/636201/geoguessr-steam-browser-game-early-access

### Local Project Fit

Observed project shape:

- Tech stack: React 19, TanStack Start, Convex, Clerk, Tailwind CSS, Vitest, Cloudflare Workers.
- Existing games: Live Quiz, Backgammon, Sudoku, Hitster.
- Catalog placeholders: Chess and Word Games.
- Existing join modes: `room`, `challenge`, `solo`.
- Existing design direction: usable catalog first, guest-friendly joining, host/player routes, QR/share links, reusable session shell.

Implication: the next games should reuse:

- `gameSessions` as the live session container.
- `sessionParticipants` for room seats and roles.
- QR/share infrastructure.
- Host/player split for room games.
- Pure rules modules under `src/lib/games/`.
- Convex mutations that validate every action server-side.

## Scoring Method

Each candidate is scored 1-5 on seven dimensions.

| Criterion | Meaning |
| --- | --- |
| Market proof | Evidence that similar mechanics retain or attract players. |
| Platform fit | How naturally the game fits current session/join architecture. |
| MVP speed | How quickly a playable, polished slice can be built. |
| Retention | Repeat-play potential through daily puzzles, rematches, stats, or social loops. |
| AI leverage | How useful AI is for content generation, tests, bots, hints, moderation, or promptable implementation. |
| Differentiation | Whether the game adds a new reason to visit beyond existing Quiz/Hitster/Sudoku/Backgammon. |
| Risk inverse | Higher score means lower legal, moderation, content, performance, and rules risk. |

Weighted recommendation score:

- Market proof: 20%
- Platform fit: 20%
- MVP speed: 15%
- Retention: 15%
- AI leverage: 10%
- Differentiation: 10%
- Risk inverse: 10%

| Game | Market | Fit | Speed | Retention | AI | Diff | Risk inverse | Weighted score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Word Links | 5 | 5 | 4 | 5 | 5 | 4 | 4 | 4.65 |
| Signal Words | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4.45 |
| Sketch Relay | 4 | 5 | 3 | 4 | 4 | 5 | 3 | 4.10 |
| Chess | 5 | 4 | 3 | 5 | 3 | 3 | 4 | 4.00 |
| Bluff Dice | 4 | 5 | 4 | 4 | 2 | 4 | 4 | 4.00 |
| The Mole Table | 4 | 5 | 3 | 4 | 4 | 5 | 2 | 3.95 |
| Fuse Team | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3.90 |
| Letter Duel | 5 | 4 | 3 | 5 | 3 | 3 | 3 | 3.90 |
| Quick Classics | 4 | 4 | 5 | 3 | 2 | 2 | 5 | 3.70 |
| Place Guess | 4 | 4 | 2 | 4 | 4 | 4 | 2 | 3.50 |
| Route Builder | 4 | 3 | 2 | 4 | 3 | 4 | 2 | 3.15 |

## Cross-Cutting Must-Haves For Every New Game

These requirements should be reused in every AI prompt.

### Session And Identity

- A game must declare `gameType`, `joinMode`, `authPolicy`, `minPlayers`, `maxPlayers`, and `supportsGuests`.
- A guest must be able to join without sign-in when the game allows it.
- A signed-in user must own created sessions.
- A returning participant on the same device must reclaim the same participant record and seat when possible.
- Server-side Convex mutations must reject illegal moves even if the client sends malformed actions.

Measurable outcomes:

- 100% of game actions pass through Convex mutations or pure local-only modules, never client-only trust for multiplayer state.
- Refreshing an active multiplayer game restores the same participant seat in at least 95% of same-device manual tests.
- Invalid session, closed session, full room, and wrong role states each have a visible user-facing error path.

### Realtime UX

- The host screen and player screens must update without manual refresh.
- Room code and QR/link sharing must appear before the game starts.
- All active players must see the same phase within one Convex subscription update.
- Disconnected players must be visibly marked after a heartbeat timeout.

Measurable outcomes:

- From host action to second client UI update: target under 500 ms on local dev, under 1500 ms on deployed preview.
- New participant appears in host lobby within 1 second in local dev.
- Manual two-browser test covers host, player, refresh, leave/rejoin, and game completion.

### Game Logic

- Core rules live in framework-free `src/lib/games/<game>.ts`.
- The pure module exposes deterministic functions for setup, legal actions, state transition, scoring, phase transitions, and winner detection.
- Convex code calls the pure module rather than duplicating rules.
- Randomness is injected or seeded where practical so tests can reproduce failures.

Measurable outcomes:

- Each new game ships with at least 15 pure logic tests for normal play, edge cases, and invalid actions.
- Multiplayer games ship with at least 5 Convex permission/state tests, or equivalent server action tests if Convex test support is unavailable.
- Illegal actions return typed errors and do not mutate persistent state.

### Accessibility And Mobile

- Phone screens must work at 360 px wide.
- Interactive targets must be at least 44 x 44 px.
- Host screens must be readable from a shared display.
- Color cannot be the only differentiator for important state.
- Keyboard navigation must cover core inputs for desktop games.

Measurable outcomes:

- No horizontal scrolling at 360 px, 768 px, and 1280 px widths.
- All controls have accessible labels or visible text.
- Lighthouse accessibility score target: 95+ for the playable route after implementation.

### Analytics

Add lightweight event names to the implementation brief even if analytics is not wired yet. At minimum, every game should define:

- `game_created`
- `participant_joined`
- `game_started`
- `turn_submitted` or `answer_submitted`
- `round_completed`
- `game_completed`
- `rematch_clicked`
- `share_clicked`
- `abandon_detected`

Measurable outcomes:

- Every event has a documented payload schema.
- Game completion, average duration, player count, and rematch rate can be derived from stored session data even before a full analytics product exists.

## Recommended Roadmap

### Phase 1: Fast Retention And Catalog Completion

Build these first:

1. Word Links.
2. Chess.
3. Signal Words.
4. Quick Classics bundle if there is a gap between larger builds.

Why:

- Word Links activates the existing `word-games` placeholder.
- Chess activates an existing catalog placeholder.
- Signal Words adds a true team party game beyond quiz/music.
- Quick Classics create reusable two-player board UI patterns and can be built quickly.

Target outcome:

- 3 new playable catalog entries.
- 1 daily habit game.
- 1 evergreen challenge game.
- 1 team room game.

### Phase 2: Party Differentiation

Build:

1. Sketch Relay.
2. Bluff Dice.
3. The Mole Table.

Why:

- Adds creative, bluffing, and social deduction categories.
- Reuses phone input and shared host screen.
- Broadens group play beyond trivia and music.

Target outcome:

- Arcade Club can support a party night with 5+ distinct room games.
- Average group session has a clear next-game recommendation.

### Phase 3: Deeper Retention

Build:

1. Letter Duel.
2. Fuse Team.
3. Place Guess only after content/licensing is solved.

Why:

- Async and cooperative play improve retention.
- More complex games should wait until session, invite, rematch, and analytics patterns are mature.

Target outcome:

- Players can return daily, play async, and host live groups from the same account.

## Game Briefs

## 1. Word Links

Genre: daily category grouping word puzzle.

Comparable products: NYT Connections, Only Connect wall, custom quiz categories.

Mode: solo first, room race second.

Player count:

- Solo: 1.
- Room race: 2-20.

Session length:

- Solo: 3-8 minutes.
- Room race: 5-12 minutes.

Recommendation: build first.

### Why Add It

Word Links is the highest-confidence next game. It matches the existing `word-games` catalog placeholder, has strong external proof from NYT Connections, and is extremely compatible with AI-assisted puzzle generation. It also creates a daily reason to return, which the current catalog does not fully provide.

This should not be a direct clone. Make it Arcade Club-native:

- Hosts can run a custom "word wall" race for groups.
- Solo players get one daily puzzle plus generated practice puzzles.
- Signed-in users can save puzzle packs.
- AI can draft puzzles, but the product should include validation checks and optional human curation.

### Core Loop

The player sees 16 tiles. They select 4 tiles that share a hidden category. Correct groups lock in and reveal a category label. Incorrect guesses consume mistakes. The puzzle ends when all 4 groups are found or the mistake limit is reached.

### MVP Scope

- Solo route: `/word-links/new` or `/word-links/daily`.
- One seeded puzzle pack with at least 20 curated puzzles.
- Puzzle state stored locally for guests and in Convex for signed-in users.
- Shareable result grid without revealing answers.
- Optional room mode where all players solve the same puzzle and a host sees progress.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Puzzle schema | 16 terms, 4 groups, category labels, difficulty order, optional explanations. | Schema rejects duplicate terms, groups not sized 4, and missing labels. |
| Guess validation | Player selects exactly 4 unlocked tiles and submits a guess. | 100% deterministic validation in pure tests. |
| Mistake tracking | Wrong guesses count down from a configured limit. | UI shows remaining mistakes and prevents further guesses after loss. |
| One-away feedback | If a guess has 3 terms from one group and 1 off-term, show "one away" once per guess. | Tests cover exact group, one-away, unrelated, and duplicate guess cases. |
| Duplicate guess prevention | Same wrong set cannot be submitted twice. | Duplicate returns typed `duplicateGuess` error and does not consume a mistake. |
| Solved group lock | Correct groups become locked and cannot be selected. | Attempting to select locked terms has no state change. |
| Result sharing | Produce spoiler-free emoji/text summary. | Share output includes date/id, result, mistakes, and group color pattern only. |
| Daily puzzle | Same puzzle available to all users for a date. | Date resolver returns identical puzzle ID across clients for the same UTC/local policy. |
| Practice puzzles | Users can play non-daily puzzles without affecting streak. | Practice route never increments daily streak. |
| Room race | Host creates room, players solve independently, host sees progress. | Host progress updates within 1 second locally for 3 players. |

### Data Model

Suggested tables:

- `wordLinkPuzzles`: puzzle content, source, status, date, difficulty, tags.
- `wordLinkAttempts`: user/guest attempt, guesses, solved groups, mistakes, status, duration.
- `wordLinkRoomStates`: room-specific leaderboard and phase.

Puzzle object:

```ts
type WordLinkPuzzle = {
  id: string;
  title?: string;
  terms: string[];
  groups: Array<{
    id: string;
    label: string;
    terms: string[];
    difficulty: "easy" | "medium" | "hard" | "tricky";
    explanation?: string;
  }>;
};
```

### Acceptance Criteria

- At least 20 curated puzzles are playable.
- At least 50 logic tests cover puzzle validation, guesses, duplicate guesses, solved groups, win/loss states, and share output.
- A first-time user can start a puzzle from the catalog in under 2 clicks.
- A completed puzzle produces a shareable result in under 1 click.
- Local two-tab room race works with host plus two players.
- No term/category content is generated at runtime without validation.

### AI Prompt

```text
You are implementing the first playable version of Word Links in this TanStack Start + Convex games platform.

Context:
- Existing platform has game catalog metadata in src/lib/games/catalog.ts.
- Existing game patterns include room games, challenge games, solo Sudoku, Convex session tables, guest-friendly joining, QR/share panels, and pure game logic under src/lib/games/.
- Build a category grouping word puzzle inspired by the genre, not a branded clone.

Goal:
Add a playable Word Links game with solo daily/practice play and a minimal room race mode.

Must-have outcomes:
1. Add framework-free pure logic in src/lib/games/word-links.ts.
2. Add tests for puzzle schema validation, guess validation, duplicate guesses, one-away detection, win/loss, solved group locking, and spoiler-free result sharing.
3. Add Convex schema/functions for puzzle attempts and room race state, or use the existing sessions model if it already supports this cleanly.
4. Add catalog entry and routes for starting/playing the game.
5. Include at least 20 curated seed puzzles in a maintainable format.
6. Keep mobile layout usable at 360 px.
7. Server-side mutations must reject illegal guesses and duplicate submissions.

Measurable acceptance:
- pnpm test passes.
- pnpm run check passes.
- pnpm run build passes.
- Manual local test: solo puzzle complete, loss state, share result, host room, two players join, progress updates.
```

## 2. Signal Words

Genre: team clue/word association party game.

Comparable products: Codenames, Decrypto, Taboo.

Mode: room/team.

Player count: 4-12 recommended, 2 minimum with co-op variant.

Session length: 15-30 minutes.

Recommendation: build after Word Links or in parallel with Chess if a party-focused release is desired.

### Why Add It

Signal Words is the best next social room game. Codenames' success shows that a small ruleset with word association can support enormous replay. It fits Arcade Club's host/player architecture because one screen can show the public grid and phones can show private spymaster information.

Build it as an original game:

- Use generic teams, signals, decoys, and traps rather than spies/agents/assassins.
- Allow custom word packs.
- Include a safe family-friendly default dictionary.
- Support co-op "clear the board before time runs out" as a later mode.

### Core Loop

Players split into two teams. Each team has a clue-giver who sees which words belong to their team. On a turn, the clue-giver submits a one-word clue and a number. Teammates select words. Correct words score, neutral words end the turn, opponent words help the other team, and trap words cause immediate loss or heavy penalty depending on settings.

### MVP Scope

- Host creates room.
- Players join and select team.
- Host can assign clue-givers or let teams choose.
- Game generates 25 public word cards and a private key.
- Clue-giver phone shows private key.
- Team guesses on shared board or phones.
- Basic win/loss detection.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Team setup | Players can join red/blue teams and one clue-giver per team is assigned. | Cannot start unless both teams have at least one guesser and one clue-giver, unless 2-player variant is enabled. |
| Board generation | 25 unique words and hidden assignments. | 100 generated boards have no duplicate visible words. |
| Private information | Only clue-givers see the hidden key. | Player query response excludes hidden assignments for non-clue-givers. |
| Clue submission | Active clue-giver submits clue and count. | Server rejects empty clues, multi-word clues, count outside 1-9, and clues matching visible board words. |
| Guess phase | Active team can select up to clue count + 1 guesses. | Server rejects guesses by inactive team and guesses after turn ends. |
| Trap handling | Trap card ends game or applies configured penalty. | Tests cover trap, neutral, own, and opponent selections. |
| Turn progression | Turn ends on pass, neutral/opponent pick, max guesses, or timeout. | State machine tests cover every phase transition. |
| Reconnect | Players retain team and role. | Refresh restores role in two-browser manual test. |

### Data Model

Suggested table:

- `signalWordsStates`: sessionId, phase, board words, hidden assignments, teams, currentTeam, clue, guesses, winner.

Keep hidden assignments server-side. If returned to the client, return them only through role-checked query for clue-givers.

### Acceptance Criteria

- Four-player manual game is playable from room creation to win/loss.
- Hidden key cannot be read by non-clue-giver route/query.
- At least 30 logic tests cover board generation, clue validation, guesses, win/loss, and turn flow.
- At least 5 Convex tests or equivalent server tests verify role restrictions.
- Mobile clue-giver screen is readable at 360 px.

### AI Prompt

```text
Implement Signal Words, an original team word-association room game for the existing Arcade Club platform.

Do not copy branded names, assets, or trade dress from any existing game. Use original language: teams, signal words, decoys, trap tile.

Must-have outcomes:
1. Add pure logic in src/lib/games/signal-words.ts with board generation, role validation, clue validation, guess application, turn flow, and winner detection.
2. Add tests for all state transitions and invalid actions.
3. Add Convex functions for creating a room, joining teams, assigning clue-givers, submitting clues, making guesses, passing, and ending the game.
4. Ensure hidden board assignments are only returned to clue-givers.
5. Add host/player routes and catalog metadata.
6. Reuse SessionShell, ParticipantList, QrSharePanel, and existing join code patterns where possible.

Measurable acceptance:
- A 4-player local test completes a full game.
- Non-clue-giver client response contains no hidden key data.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 3. Sketch Relay

Genre: drawing telephone and fake-caption party game.

Comparable products: Gartic Phone, Drawful, Telestrations, Jackbox drawing games.

Mode: room.

Player count: 3-12.

Session length: 10-25 minutes.

Recommendation: build as the first creative party game after one more word game ships.

### Why Add It

Arcade Club currently has quiz, music timeline, board strategy, and solo logic. It does not yet have a creative laughter game. Drawing party games are highly social, work naturally with phones, and produce shareable artifacts.

The main risk is moderation and content. The MVP should keep controls simple:

- Host can use family-friendly generated prompts.
- Host can disable custom prompts.
- Players can report/hide a drawing.
- Rooms can be private-by-link only.

### Core Loop

Each player receives a prompt, draws it on their phone, and submits. Drawings rotate to another player who writes a caption, then another player draws the caption, continuing for several rounds. At the end, the host reveals each chain.

Alternative MVP if drawing canvas is too much: fake-caption mode. The host shows a strange prompt/image, players write captions, then vote.

### MVP Scope

- Room creation and lobby.
- Prompt assignment.
- Touch-friendly drawing canvas with pen, eraser, undo, clear, and submit.
- Caption input.
- Round timer.
- Reveal gallery.
- Optional voting for funniest/most accurate.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Drawing canvas | Touch and mouse drawing with undo/clear. | User can draw and submit on 360 px mobile viewport. |
| Stroke storage | Store vector strokes or compressed image safely. | A submitted drawing reloads identically after refresh. |
| Turn assignment | Each player receives exactly one item per round. | Tests verify no player receives their own previous item unless player count requires it. |
| Timers | Host-configured round time. | Late submissions rejected after phase closes. |
| Reveal mode | Host reveals chains one at a time. | All clients see same reveal index within 1 second locally. |
| Moderation | Host can hide a submitted panel. | Hidden panel is replaced with neutral placeholder for all clients. |
| Profanity guard | Custom text input passes through a basic filter or host review. | Seeded banned words blocked in tests. |

### Data Model

Suggested tables:

- `sketchRelayStates`: session phase, round, settings, reveal index.
- `sketchRelaySubmissions`: session, participant, round, type, text, drawing payload, hidden flag.

Prefer vector strokes for editability and smaller payloads:

```ts
type SketchStroke = {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};
```

### Acceptance Criteria

- 3-player room completes a full relay and reveal.
- Drawing works with mouse and touch.
- A refresh does not lose submitted drawings.
- Host can hide a submission before or during reveal.
- At least 20 tests cover assignment, phases, late submissions, hiding, and scoring/voting if included.

### AI Prompt

```text
Implement Sketch Relay, a private room drawing telephone game.

Use the existing Arcade Club session architecture. Prioritize a robust mobile drawing canvas and deterministic room state over visual complexity.

Must-have outcomes:
1. Pure game flow logic in src/lib/games/sketch-relay.ts.
2. Touch/mouse drawing component with pen, eraser, undo, clear, submit.
3. Convex state for rounds, assignments, submissions, and reveal.
4. Host controls for start, next reveal, hide submission, and rematch.
5. Player route for drawing/captioning and waiting states.
6. Tests for assignment, phase transitions, late submissions, hidden submissions, and reveal order.

Measurable acceptance:
- 3 players can complete a full game locally.
- Submitted drawings survive refresh.
- 360 px mobile viewport remains usable.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 4. Chess

Genre: classic abstract strategy.

Mode: challenge, later async and tournaments.

Player count: 2.

Session length: 5-60 minutes depending on time control.

Recommendation: build early because it is already in the catalog.

### Why Add It

Chess is an evergreen game with massive demand and clear rules. It also establishes credibility for direct challenge games after Backgammon. The right MVP is not a Chess.com competitor. It should be a clean challenge-link chess board with legal moves, clock options, rematch, and optional guest play.

Use a proven TypeScript chess rules library if possible. Do not hand-roll the rules unless there is a strong reason.

### MVP Scope

- Challenge creation.
- Seat claiming for white/black/random.
- Legal move generation and validation.
- Check, checkmate, stalemate, draw by insufficient material.
- Basic clocks: untimed and 10+0.
- Move list in algebraic notation.
- Resign and offer draw.
- Rematch.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Rules engine | Use proven library or fully tested pure rules module. | Legal move test suite covers at least 50 FEN positions if local rules are implemented. |
| Seat claiming | First player creates, second claims open seat. | Cannot move unless seated as active color. |
| Move validation | Server validates all submitted moves. | Illegal move mutation returns typed error and leaves FEN unchanged. |
| Game end | Checkmate, stalemate, resignation, timeout, draw. | Tests cover every terminal state. |
| Clock | Server records remaining time and last move timestamp. | Timeout can be claimed server-side. |
| Reconnect | Player returns to same color. | Manual refresh retains seat. |
| Move log | Algebraic notation or UCI fallback displayed. | Move log length equals half-move count. |

### Acceptance Criteria

- Two-browser challenge game works from create to checkmate/resign.
- Illegal move attempts are rejected server-side.
- At least one timed game can end by timeout claim.
- Board is playable on desktop and usable on mobile.
- pnpm test/check/build pass.

### AI Prompt

```text
Implement playable Chess as a direct challenge game in Arcade Club.

Use an established TypeScript chess rules library unless the repository already has a suitable local module. Do not hand-roll chess rules without explicit approval.

Must-have outcomes:
1. Add catalog route from existing chess placeholder to a real /chess/new and /chess/$sessionId flow.
2. Implement challenge creation, share link/QR, seat claiming, white/black/random assignment.
3. Validate moves server-side and persist FEN, move history, active color, status, result, and clocks.
4. Support untimed and 10+0 time controls.
5. Add resign, draw offer, draw accept/decline, and rematch.
6. Add tests for legal/illegal moves, permissions, game end states, and clock timeout.

Measurable acceptance:
- Two-player local game can finish by checkmate, resignation, and timeout claim.
- Non-active player cannot move.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 5. Bluff Dice

Genre: bluffing dice game.

Comparable products: Liar's Dice, Perudo, Skull-like bluffing.

Mode: room or challenge.

Player count: 2-8.

Session length: 10-20 minutes.

Recommendation: build as a fast room game after the first word game.

### Why Add It

Bluff Dice adds suspense, table talk, and short rounds without requiring content generation. It works on phones because each player needs private dice and a simple public bid history.

Avoid casino framing. Use no money, no betting, no real stakes, and no gambling language in UI beyond "bid" if acceptable. "Claim" and "challenge" can replace betting terms.

### Core Loop

Each player has hidden dice. Players make increasing claims about how many dice of a face exist across all players. A player can challenge the previous claim. Dice are revealed. The loser loses a die. Last player with dice wins.

### MVP Scope

- Host creates room.
- 2-8 players join.
- Each player sees only their dice.
- Public claim history.
- Challenge/reveal phase.
- Player elimination.
- Rematch.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Private dice | Only owning player can see their dice before reveal. | Non-owner query excludes dice values. |
| Claim validation | New claim must outrank previous claim. | Tests cover quantity and face rank ordering. |
| Challenge | Any active next player can challenge previous claim. | Reveal determines loser deterministically. |
| Elimination | Loser loses one die; zero dice eliminates player. | Tests cover elimination and winner. |
| Turn order | Skips eliminated players. | Tests cover 2, 3, and 8 player turn loops. |
| Reconnect | Hidden dice remain visible to owner only after refresh. | Manual two-browser test verifies privacy. |

### Acceptance Criteria

- 3-player game completes to a winner.
- Hidden dice are private until reveal.
- At least 25 logic tests cover claims, challenge resolution, dice loss, elimination, and turn order.
- UI clearly separates private hand from public table.

### AI Prompt

```text
Implement Bluff Dice, a non-gambling bluffing dice room game.

Use original neutral language and avoid casino/money framing. Reuse Arcade Club room sessions and guest joining.

Must-have outcomes:
1. Pure logic in src/lib/games/bluff-dice.ts for dice rolling, claim ordering, challenge resolution, elimination, turn order, and winner detection.
2. Convex functions for room creation, join, start, submit claim, challenge, next round, and rematch.
3. Player query must return private dice only for the requesting participant.
4. Host/table view shows players, claim history, round status, and reveal.
5. Tests for privacy shape, invalid claims, challenge outcomes, elimination, and winner.

Measurable acceptance:
- 3-player local game completes.
- Non-owner cannot read another player's dice before reveal.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 6. The Mole Table

Genre: social deduction lite.

Comparable products: Spyfall, Insider, Werewolf/Mafia, Fakin' It, Push the Button.

Mode: room.

Player count: 4-10.

Session length: 8-20 minutes.

Recommendation: build after the platform has at least two polished room games and host moderation controls.

### Why Add It

Social deduction games create memorable group sessions and repeat play because the content comes from people. They are also risky: players can be confused, excluded, or toxic if the UX is weak. The MVP should be short, private-room-only, and heavily guided.

### Core Loop

Most players receive the same secret location/topic/object. One player is the Mole and receives either no topic or a related but incomplete clue. Players ask each other questions for a timed round. Then everyone votes on who the Mole is. The Mole can win by surviving or by guessing the secret.

### MVP Scope

- Host room.
- Role assignment.
- Secret prompt display.
- Timer.
- Structured question suggestions.
- Voting.
- Mole final guess.
- Reveal and rematch.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Role privacy | Only participant sees their role/prompt. | Non-owner query excludes role data. |
| Prompt packs | Family-safe pack with topics. | At least 100 seed prompts across 10 categories. |
| Timer | Discussion phase has visible countdown. | Server phase closes after configured duration or host action. |
| Voting | One vote per active player. | Duplicate vote updates or rejects by explicit rule. |
| Mole guess | If voted Mole, Mole can guess secret for comeback win. | Tests cover town win, Mole survive win, Mole guess win. |
| Onboarding | Every role has concise instructions. | No player screen shows blank state during active phase. |
| Moderation | Host can kick player before game start. | Kicked player cannot submit votes/actions. |

### Acceptance Criteria

- 5-player game completes with role reveal.
- Role/prompt privacy is server-enforced.
- At least 100 safe prompts included.
- Tests cover role assignment, vote tally, tie handling, Mole guess, and kicked players.

### AI Prompt

```text
Implement The Mole Table, a private-room social deduction game.

The game must be clear for first-time players and safe for guest play. Keep the MVP short and guided.

Must-have outcomes:
1. Pure logic in src/lib/games/mole-table.ts for role assignment, prompt selection, phases, voting, tie handling, Mole guess, and winner detection.
2. Convex functions for start, kick before start, advance phase, submit vote, submit Mole guess, and rematch.
3. Role and secret prompt data must only be returned to the owning participant.
4. Include at least 100 family-safe prompts grouped by category.
5. Add role-specific instruction panels and question suggestions.
6. Add tests for privacy, role distribution, all win conditions, ties, and kicked players.

Measurable acceptance:
- 5-player local game completes.
- Non-owner cannot read another role/prompt.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 7. Fuse Team

Genre: cooperative deduction logic game.

Comparable products: Bomb Busters, Hanabi, The Crew, cooperative logic puzzles.

Mode: room/co-op.

Player count: 2-5.

Session length: 10-25 minutes.

Recommendation: build after Signal Words because it uses similar hidden-information patterns but with co-op scoring.

### Why Add It

Most current recommendations are competitive. A cooperative deduction game gives Arcade Club a calmer, teamwork-oriented option. This is useful for families, couples, classrooms, and groups that do not want aggressive party games.

### Core Loop

Players each hold hidden numbered "wires" or "codes" visible to others but not themselves. They use limited clues/actions to identify matching pairs and avoid dangerous items. The team wins by clearing all safe items before mistakes run out.

Use an original theme and ruleset. Do not copy campaign structure, component names, or scenario designs from any commercial game.

### MVP Scope

- 2-5 player room.
- Hidden own-hand / visible others-hand state.
- Turn actions: ask clue, mark suspicion, cut/confirm item.
- Shared mistake counter.
- Win/loss.
- 10 hand-authored scenarios.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Perspective query | Player cannot see their own secret values but can see others. | Tests verify per-participant response shape. |
| Scenario setup | Scenario defines deck, danger count, clue budget, win condition. | 10 valid scenarios pass schema validation. |
| Legal actions | Active player can clue, mark, or cut. | Server rejects invalid action for phase/turn. |
| Mistake handling | Wrong cut consumes mistake or triggers loss. | Tests cover perfect win, mistake win, and loss. |
| Co-op result | Team result and stars/score saved. | Session records score, duration, scenario ID. |

### Acceptance Criteria

- 2-player and 5-player scenarios are playable.
- Perspective privacy works correctly.
- 10 scenarios included.
- At least 30 logic tests cover setup, perspectives, legal actions, clue budgets, win/loss, and scoring.

### AI Prompt

```text
Implement Fuse Team, an original cooperative hidden-information deduction game.

Do not copy names, art, scenarios, or trade dress from existing commercial games. Build an original rules-light MVP.

Must-have outcomes:
1. Pure logic in src/lib/games/fuse-team.ts.
2. Scenario schema and 10 hand-authored scenarios.
3. Convex functions for room creation, start scenario, submit action, advance turn, and rematch.
4. Perspective-safe queries: each player cannot see their own hidden values.
5. Shared win/loss state, mistake counter, score, and duration.
6. Tests for scenario validation, perspective shape, legal actions, win/loss, and scoring.

Measurable acceptance:
- 2-player and 5-player local games complete.
- No player can query their own hidden values.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 8. Letter Duel

Genre: two-player word tile board.

Comparable products: Scrabble, Words With Friends, NYT Crossplay.

Mode: challenge, async later.

Player count: 2.

Session length: 10-45 minutes live, days async.

Recommendation: build after Word Links unless the product direction becomes word-game-heavy.

### Why Add It

The Verge's NYT Crossplay coverage shows that even major publishers are investing in classic competitive word games as standalone experiences. A two-player word duel fits challenge links and can become the first async game.

The risk is dictionary quality and rules complexity. Use a public word list with a clear license and keep board bonuses original.

### MVP Scope

- 2-player challenge.
- Tile bag and racks.
- Board placement.
- Dictionary validation.
- Scoring.
- Pass/exchange/resign.
- Live mode first.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Word list | Licensed dictionary loaded server-side or bundled. | Invalid words rejected in tests. |
| Tile bag | Deterministic draw from configured distribution. | Tests verify tile counts never exceed distribution. |
| Placement validation | Tiles must form contiguous legal words. | Tests cover first move, cross words, disconnected tiles, invalid overlaps. |
| Scoring | Letter values and board bonuses applied. | Golden tests for 20 scoring examples. |
| Rack privacy | Only owner sees rack. | Non-owner query excludes rack letters. |
| End state | Empty bag/rack, passes, resignation. | Tests cover every terminal state. |

### Acceptance Criteria

- A full 2-player game can complete.
- At least 20 scoring golden tests.
- Rack privacy server-enforced.
- Dictionary license documented in source.

### AI Prompt

```text
Implement Letter Duel, an original two-player word tile challenge game.

Use a license-safe dictionary and original board/bonus layout. Do not use branded names or assets from existing word games.

Must-have outcomes:
1. Pure logic in src/lib/games/letter-duel.ts for tile bag, racks, placement validation, dictionary validation, scoring, turn flow, and end state.
2. Document dictionary source and license.
3. Convex functions for challenge creation, seat claiming, move submission, pass, exchange, resign, and rematch.
4. Rack letters are private to each player.
5. Tests include placement validation and 20 scoring golden examples.

Measurable acceptance:
- 2-player local game completes.
- Non-owner cannot read rack.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 9. Quick Classics Bundle

Genre: classic abstract two-player games.

Games: Connect Four, Reversi, Checkers.

Mode: challenge.

Player count: 2.

Session length: 3-20 minutes.

Recommendation: use as a platform hardening slice, not as the headline feature.

### Why Add It

These games are quick to implement, easy to test, and useful for hardening common challenge flows: seat assignment, turn order, rematch, move log, resign, and spectator view. They are less differentiated than party/daily games but excellent for engineering momentum.

### MVP Scope

Build one shared "abstract challenge" route pattern and add games incrementally:

1. Connect Four first.
2. Reversi second.
3. Checkers third.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Shared challenge shell | Seat assignment, share, turns, resign, rematch. | All three games use same shell/component pattern. |
| Pure rules | Each game has legal moves and winner detection. | 20+ tests per game. |
| Fast start | Player can start from catalog quickly. | Challenge link generated in under 2 clicks. |
| Mobile board | Board remains square and touch-friendly. | No layout shift at 360 px. |

### Acceptance Criteria

- Connect Four ships first with full tests.
- Reversi and Checkers are not added until Connect Four pattern is clean.
- Shared challenge shell does not regress Backgammon/Chess routes.

### AI Prompt

```text
Implement Connect Four as the first game in a Quick Classics challenge bundle.

Focus on reusable direct-challenge architecture, not a one-off implementation.

Must-have outcomes:
1. Pure logic in src/lib/games/connect-four.ts.
2. Tests for legal drops, full columns, horizontal/vertical/diagonal wins, draw, invalid moves.
3. Reuse or extract a shared challenge shell if it fits existing patterns without broad refactor.
4. Add catalog entry, /connect-four/new, and /connect-four/$sessionId.
5. Support guest challenge link, seat claiming, turn enforcement, resign, and rematch.

Measurable acceptance:
- Two-player game completes by win and draw in tests.
- Illegal move rejected server-side.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## 10. Place Guess

Genre: geography/photo guessing.

Comparable products: GeoGuessr, travel quizzes, map games.

Mode: solo and room.

Player count:

- Solo: 1.
- Room: 2-20.

Session length: 5-15 minutes.

Recommendation: defer until content sourcing is solved.

### Why Add It

Place guessing is intuitive, competitive, and stream-friendly. It can also be educational. The problem is content. Arcade Club should not depend on scraping Street View or unlicensed image sets. A safe MVP can use:

- User-uploaded private photo packs.
- Public-domain/CC-licensed landmark images with attribution.
- Host-created custom packs.
- Map guessing with broad regions rather than exact coordinates.

### MVP Scope

- A curated, license-safe pack of 100 images.
- Guess on map or multiple-choice region.
- Distance-based scoring if coordinates are available.
- Room mode where all players guess, then reveal.

### Must-Have Functionality

| Functionality | Required behavior | Measurable outcome |
| --- | --- | --- |
| Content license | Every image has source, license, attribution, coordinates/region. | Build fails or validation fails for missing attribution/license. |
| Guess input | Player can place map pin or choose region. | 360 px mobile map/choice UI usable. |
| Scoring | Distance or region score calculated server-side. | Golden tests for scoring distances. |
| Reveal | Shows correct location and player guesses. | Host reveal updates all players within 1 second locally. |
| Pack management | Packs can be curated and disabled. | Disabled pack cannot start new games. |

### Acceptance Criteria

- 100 image pack has documented licenses.
- Room mode completes a 5-round game.
- No external API key is required for MVP unless explicitly configured.
- Scoring tests cover exact, near, far, and wrong-continent guesses.

### AI Prompt

```text
Implement Place Guess only using license-safe content.

Do not scrape Street View or depend on unlicensed images. The MVP may use a curated local/public-domain image pack or a multiple-choice map mode.

Must-have outcomes:
1. Content schema requires source URL, license, attribution, and coordinates or accepted region.
2. Add validation that rejects content missing license metadata.
3. Pure scoring logic in src/lib/games/place-guess.ts.
4. Solo and room routes for 5-round games.
5. Host reveal shows correct location and player guesses.
6. Tests for content validation and scoring.

Measurable acceptance:
- 100 licensed images or prompts included.
- 5-round room game completes.
- pnpm test, pnpm run check, and pnpm run build pass.
```

## Cross-Game Platform Features To Add

These are not games, but they raise the quality of every future AI prompt.

### 1. Game Definition Registry

Create a central registry that extends catalog metadata with implementation capabilities.

Suggested shape:

```ts
type GameDefinition = {
  type: GameType;
  title: string;
  joinMode: "room" | "challenge" | "solo";
  minPlayers: number;
  maxPlayers: number;
  supportsGuests: boolean;
  supportsRematch: boolean;
  supportsSpectators: boolean;
  routeBuilders: {
    new: () => string;
    play: (sessionId: string) => string;
    host?: (sessionId: string) => string;
  };
};
```

Measurable outcome:

- Catalog, join routing, and session creation all read from one typed registry.
- Adding a new game requires updating one metadata file plus game-specific routes/functions.

### 2. Shared Game Analytics Schema

Even without a third-party analytics tool, session records should contain enough information to answer:

- How many sessions were created?
- How many started?
- How many completed?
- How many players joined?
- How long did games last?
- How many rematches happened?
- Which games are abandoned most often?

Measurable outcome:

- Each completed session records `startedAt`, `endedAt`, `completedReason`, `participantCount`, `winnerParticipantIds`, and `rematchOfSessionId` where relevant.

### 3. Rematch And Next Game Flow

Every multiplayer game should end with:

- Rematch.
- New game same type.
- Try recommended next game.
- Share result.

Measurable outcome:

- At least 25% of completed manual test sessions can start a rematch without returning to catalog.
- End screen is shared across at least two games.

### 4. AI Content Workbench

For Word Links, Signal Words, The Mole Table, Fuse Team, and Place Guess, AI can draft content. The platform should separate generation from publication.

Workflow:

1. AI drafts content in JSON.
2. Validator checks schema, duplicates, offensive words, length, ambiguity, and license fields.
3. Human or admin marks content as approved.
4. Only approved content appears in public play.

Measurable outcome:

- No generated puzzle/prompt can be played publicly unless `status === "approved"`.
- Validator returns actionable errors with field paths.

## Master AI Prompt Template

Use this when asking an AI coding agent to implement any new game.

```text
You are working in the Arcade Club repository, a TanStack Start + React + Convex + Clerk games platform.

Before editing:
- Inspect README.md, src/lib/games/catalog.ts, existing game routes, Convex schema/functions, and tests for the closest existing game pattern.
- Preserve unrelated user changes.
- Follow existing project patterns.

Game to implement:
[GAME_NAME]

Product goal:
[ONE PARAGRAPH DESCRIPTION]

Mode:
[solo / room / challenge / async]

Must-have functionality:
[PASTE GAME-SPECIFIC TABLE OR REQUIREMENTS]

Architecture requirements:
1. Put deterministic framework-free game rules in src/lib/games/[game-id].ts.
2. Add focused tests under src/lib/games/__tests__/[game-id].test.ts.
3. Use Convex as source of truth for multiplayer state.
4. Validate permissions and illegal actions server-side.
5. Reuse existing session, participant, QR/share, and catalog patterns.
6. Keep guest participation working where the game allows it.
7. Keep mobile layout usable at 360 px.

Acceptance criteria:
1. pnpm test passes.
2. pnpm run check passes.
3. pnpm run build passes.
4. Manual flow works for create, join, play, refresh, finish, and rematch.
5. New code has no broad unrelated refactors.

Deliverables:
- Implementation files.
- Tests.
- Any seed content needed for the MVP.
- Short summary of manual verification.
```

## Prompt Template For AI Content Generation

Use this for games where AI drafts puzzle/prompt content. Keep generated content out of production until validated.

```text
Generate content for [GAME_NAME].

Audience:
- Family-friendly.
- International English.
- Avoid politics, explicit content, slurs, medical/legal claims, current tragedies, and copyrighted fictional universes.

Output format:
- Valid JSON only.
- Match this TypeScript type exactly:
[PASTE TYPE]

Quality rules:
1. No duplicate visible terms within a puzzle.
2. Avoid obscure trivia unless the difficulty says "expert".
3. Include explanations for every answer/group.
4. Avoid ambiguity where multiple answers could be equally valid.
5. Include difficulty and tags.
6. Include a short rationale for why the item is fun.

Validation:
- After generating, self-check for duplicates, ambiguity, offensive content, and schema validity.
- Return only the final JSON.
```

## IP And Safety Guidance

This document names comparable products for research and positioning. Implementation should avoid copying:

- Product names.
- Logos.
- Visual trade dress.
- Proprietary art, boards, cards, prompts, music, or datasets.
- Commercial scenario designs.
- Distinctive phrasing from another game's UI.

General mechanics and classic rules are often implementable, but implementation should still use original presentation and content. When in doubt, build an original variant and document the design differences.

Games to treat with extra care:

- Music games: licensing for song previews and metadata.
- Geo games: image/map/Street View licensing.
- Word tile games: dictionary license.
- Social deduction/drawing games: moderation and user-generated content.
- Poker/casino-like games: avoid gambling framing, real money, wagering, and loot mechanics.

## Definition Of Done For Adding A New Game

A game should not be considered "added" until all items below are true.

- Catalog card is visible and routes to a playable flow.
- Game can be started by the intended user type.
- Game can be completed to a terminal state.
- Invalid actions are rejected server-side.
- Refresh/reconnect works.
- Guest behavior matches the game's auth policy.
- Mobile layout works at 360 px.
- Logic tests cover core rules.
- Server/action tests cover permissions where practical.
- End screen offers rematch or next action.
- `pnpm test`, `pnpm run check`, and `pnpm run build` pass.
- Any generated or curated content has validation and source/license metadata where applicable.

## Final Recommendation

Start with Word Links. It has the best mix of market validation, implementation speed, AI leverage, retention, and fit with the existing catalog.

Then finish Chess because it is already promised in the catalog and will harden challenge-link infrastructure.

Then add Signal Words because it makes Arcade Club feel like a true group games platform rather than a set of isolated games.

After those three, choose based on product goal:

- More parties: Sketch Relay, Bluff Dice, The Mole Table.
- More daily retention: Letter Duel, more Word Links packs, Fuse Team.
- More engineering foundation: Quick Classics bundle.
- More novelty: Place Guess, but only after content licensing is solved.
