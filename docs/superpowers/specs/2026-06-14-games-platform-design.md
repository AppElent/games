# Games Platform Design

## Context

This project is a freshly scaffolded TanStack Start web app with Clerk authentication, Convex, Tailwind CSS, Biome, Vitest, and Cloudflare deployment wiring. It should become an Arcade Club-style games website where people can play live multiplayer games, direct two-player challenge games, solo games, and future party modes.

The design follows patterns from the existing AppElent projects:

- React 19 + TanStack Start with file-based routes.
- Convex as the source of truth for real-time state.
- Clerk authentication where signed-in users get ownership, continuity, and history.
- Server-side permission checks in Convex.
- Pure game logic isolated in `src/lib/` and tested with Vitest.
- A product-like route map, concise docs, and reusable UI primitives instead of a loose demo scaffold.

## Product Shape

The app becomes an **Arcade Club**: a dark, energetic multiplayer games hub built around reusable game sessions.

The first release includes:

- **Home / Game Catalog**: playable cards for Live Quiz and Backgammon, plus polished placeholders for Sudoku, Chess, Hitster, Word games, and future party games.
- **Game Sessions**: the shared foundation for active and completed games. Sessions support different join modes instead of forcing every game into the same room UI.
- **Live Quiz**: the first complete party/projection game. A host controls rounds on a shared screen; players answer on phones; scores update live.
- **Backgammon**: the first direct two-player challenge game. One player starts a game, shares a link or QR code, and the second player joins directly.
- **Profiles / History**: signed-in users can own sessions and later see saved games. Guests can join low-friction sessions when the game allows it.

The core principle is: **game sessions are the platform; each game chooses the right join flow**.

## Join Modes

Different games should feel natural instead of being squeezed into one lobby model.

- **Room**: for many-player host-led games such as Live Quiz and Hitster. A host creates a room, players join with a code/link/QR, and the host controls progression.
- **Challenge**: for direct two-player games such as Backgammon and Chess. A player starts a challenge, shares a link or QR, and another player claims the open seat.
- **Solo**: for puzzle games such as Sudoku. A player starts immediately and the app saves state when signed in.
- **Future modes**: team, tournament, async, or custom modes can be added later without changing the whole platform.

Auth policy is per game and per session where useful:

- Anonymous players can join quick sessions when allowed.
- Signed-in users can create, own, and recover sessions.
- Some games may require sign-in for ranked play, persistence, or abuse control.
- Hosts can choose stricter policies where the game supports it.

## Architecture

The platform uses Convex for live state and a reusable session model.

Core tables:

- `gameSessions`: one row per active or completed game instance. Fields include `gameType`, `status`, `joinMode`, `hostUserId`, `hostParticipantId`, `joinCode`, `shareToken`, `authPolicy`, timestamps, and optional settings.
- `sessionParticipants`: signed-in or guest players/watchers. Stores display name, optional user id, role, seat, connected status, and `lastSeen`.
- `quizSets`: reusable question sets owned by signed-in users or seeded as samples.
- `liveQuizStates`: session-specific quiz state such as current question index, phase, timer, scoring rules, and reveal state.
- `liveQuizAnswers`: player answers for each question.
- `backgammonStates`: session-specific board state, dice, turn, move history, winner, and rules engine metadata.

Game-specific state should stay in game-specific tables when it improves validation and querying. A generic JSON blob is acceptable only for temporary scaffolding or games whose state does not need structured queries.

## Data Flow

- Clerk provides signed-in identity when present.
- Convex owns all live state and publishes real-time updates to React.
- Creating a session returns either a `joinCode` for room-style games or a `shareToken` URL for challenge-style games.
- Guests get a local guest identity and become `sessionParticipants` when they join.
- Game-specific mutations receive `{ sessionId, participantId, action }`, validate permissions, apply game rules, and write the next state.
- Game screens subscribe to compact bundle queries so each screen receives session, participants, and game state together.

Authed Convex queries must follow the Roadmaps convention: use `useConvexAuth()` and pass the `"skip"` sentinel until authentication settles. Public join/share flows get intentionally unauthenticated read paths with narrow scope.

## Screens

Initial route map:

- `/`: public Arcade Club home with game catalog, quick actions, and join panel.
- `/dashboard`: signed-in hub with recent sessions, saved games, created quiz sets, and quick actions.
- `/join`: accepts room codes, shared links, and QR targets, then routes into the right flow.
- `/quiz/new`: create a quick quiz or pick a sample quiz set.
- `/quiz/$sessionId/host`: host presentation screen with lobby, current question, reveal, and scoreboard.
- `/quiz/$sessionId/play`: phone-friendly player screen.
- `/backgammon/new`: starts a challenge and immediately shows share link + QR.
- `/backgammon/$sessionId`: two-player board screen with seat assignment, turn controls, dice, move history, and rematch.
- `/games/$gameType`: placeholder/detail pages for future games.

The home page should be the actual usable experience, not a marketing landing page.

## Components

Reusable platform components:

- `GameCatalog`
- `GameCard`
- `ComingSoonCard`
- `JoinGamePanel`
- `QrSharePanel`
- `ParticipantList`
- `SessionShell`
- `SeatBanner`

Live Quiz components:

- `QuizSetupForm`
- `QuizHostView`
- `QuizPlayerView`
- `QuestionPresenter`
- `AnswerPad`
- `Scoreboard`

Backgammon components:

- `BackgammonBoard`
- `DiceTray`
- `MoveLog`
- `SeatBanner`
- `RematchPanel`

The visual direction is **Arcade Club**: dark, lively, social, and neon-accented, with enough clean structure that ownership, saved games, and join states stay clear. The user selected Arcade Club after briefly exploring Command Center, so the design should keep Arcade Club energy while borrowing Command Center clarity for session management.

## Game Logic

Pure game logic belongs in framework-free modules under `src/lib/games/`.

Suggested modules:

- `src/lib/games/catalog.ts`: game metadata, join modes, placeholder flags, and display configuration.
- `src/lib/games/sessions.ts`: shared session helpers, join code formatting, share URL helpers, participant role helpers.
- `src/lib/games/quiz.ts`: scoring, phase transitions, answer validation, timing helpers.
- `src/lib/games/backgammon.ts`: adapter around a rules package if a suitable one exists, otherwise local move generation and win detection.

Backgammon should use a proven rules engine if one is suitable for browser/server TypeScript usage. If no suitable package is available, implement core rules with tests before building the UI: legal moves, dice usage, hitting, bar entry, bearing off, doubling cube if included, and win detection.

## Error Handling

- Expired, missing, or closed links show a friendly "game unavailable" state with actions to start a new game or return home.
- Full games explain whether the user can watch, request a rematch, or start a new game.
- Reconnects use participant identity and `lastSeen` to restore the same seat when possible.
- Illegal moves are rejected server-side and surfaced as inline game feedback.
- Quiz players who join mid-game wait until the next question unless host settings allow late scoring.
- Guest identities should survive refreshes on the same device through local storage, but should not be trusted for authorization without Convex-side participant checks.

## Testing

Testing should focus first on logic and session permissions.

- Pure game logic in `src/lib/games/*` gets fast Vitest coverage.
- Convex tests cover session creation, joining, auth policies, guest participation, seat claiming, and illegal actions.
- Live Quiz tests cover scoring, answer windows, late join behavior, and phase transitions.
- Backgammon tests cover move legality, dice consumption, hitting, bar entry, bearing off, and win detection.
- Component tests cover key UI states: empty catalog, quiz lobby, active question, reveal, scoreboard, backgammon waiting-for-opponent, active turn, and finished game.
- Verification before implementation completion should include `npm run check`, `npm run test`, and `npm run build`.

## First Implementation Slice

The first buildable slice should be:

1. Replace starter/demo app shell with the Arcade Club catalog and shared navigation.
2. Add game catalog metadata with Live Quiz, Backgammon, and future placeholders.
3. Add the Convex session schema and basic create/join/list mutations.
4. Implement Live Quiz as the first complete room-style game.
5. Implement Backgammon challenge creation and waiting/join flow.
6. Add or integrate Backgammon rules, then build the playable board.

This ordering keeps the reusable session foundation real while still delivering a visible multiplayer game early.

## Out Of Scope For First Slice

- Ranked matchmaking.
- Public game browsing.
- Tournament brackets.
- Persistent social graph or friends list.
- Full analytics dashboard.
- User-generated Hitster/music licensing features.
- Real-time voice/video.
- Payment or premium features.

These can be added later once sessions, join flows, and the first games are stable.
