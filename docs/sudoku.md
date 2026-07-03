# AI Coding Goal: Add Sudoku to Arcade Club

Build a complete Sudoku MVP for the existing Arcade Club web app: a solo Sudoku game with rich notation, saved state, multiple difficulty levels, technique-based coaching, and scan import for printed or handwritten paper puzzles with user verification before play starts.

## Successful Outcome

A user can start, play, annotate, pause, resume, import, and complete Sudoku puzzles in the app.

The implementation is successful when a user can:

1. Start a new Sudoku at multiple difficulty levels:
   - easy
   - medium
   - hard
   - expert

2. Persist the game as a solo `gameSession`.

3. Enter final digits into the Sudoku grid.

4. Use rich notation modes:
   - corner notes for Snyder-style pairs or small candidate groups
   - center notes for full candidate sets
   - color/highlight marks for visual reasoning
   - optional automatic candidate cleanup as a setting, not forced behavior

5. Select cells and digits comfortably on desktop and mobile.

6. Use:
   - undo
   - redo
   - erase
   - restart
   - pause
   - resume

7. Highlight:
   - selected cell
   - selected digit
   - row
   - column
   - 3x3 box
   - peer cells
   - conflicts
   - user-marked reasoning highlights

8. Validate Sudoku rule conflicts without automatically revealing the solution.

9. Detect completion and mark the session completed.

10. Scan/import a paper Sudoku from mobile camera or image upload.

11. Import printed and handwritten paper puzzles, including partially solved puzzles.

12. Review and correct the scan result in a verifier screen before the puzzle is created.

13. Have multiple active games at the same time. Naming the sessions is a plus, next to auto naming based on level and date-time.

## Scan Import Scope

The scan/import flow is in scope for the first Sudoku build.

The scan flow must support:

1. Capturing or uploading an image.
2. Detecting the Sudoku grid.
3. Applying perspective correction.
4. Segmenting the 81 cells.
5. Recognizing printed digits.
6. Recognizing handwritten full-size digits.
7. Recognizing handwritten pencil notes / candidates.
8. Assigning confidence scores to recognized content.
9. Showing a verifier screen before creating the puzzle.

## Handwriting Recognition Scope

The scan/import flow must classify each cell as one of:

1. `given`
   A printed clue from the original puzzle. This is locked in the app.

2. `userDigit`
   A handwritten full-size digit already placed by the player. This is editable/removable after import.

3. `cornerNotes`
   Small handwritten candidate marks near cell corners.

4. `centerNotes`
   Small handwritten candidate marks near the center of the cell.

5. `empty`
   No recognized content.

This is required because a user may scan a partially solved paper Sudoku and continue digitally.

## Verifier Screen Requirements

Before a scanned puzzle becomes playable, the app must show a verifier screen.

The verifier must include:

1. Original image preview.
2. Detected grid overlay.
3. Extracted 9x9 grid.
4. OCR/classification result per cell.
5. Low-confidence cells highlighted.
6. Editable recognized digits.
7. Editable classification type per cell.
8. Controls to clear a cell.
9. Preview of the final app board exactly as it will be created.

The user must be able to:

1. Change `given` to `userDigit`, note, or empty.
2. Change `userDigit` to given, note, or empty.
3. Edit corner notes.
4. Edit center notes.
5. Clear a cell.
6. Correct low-confidence recognitions.
7. Confirm the final grid before starting.

## Scan Validation Rules

Before creating the Sudoku session:

1. `given` and `userDigit` values are checked for row, column, and box conflicts.
2. Notes are not treated as placed digits.
3. If handwritten user digits make the puzzle invalid, the verifier blocks start until corrected.
4. The original givens should define a solvable puzzle.
5. Preferably, the original givens should define exactly one solution.
6. If user digits are included, they must be compatible with at least one valid solution.
7. A wrong OCR result must never silently become a playable puzzle.
8. The user must explicitly confirm the recognized grid.

Handwritten recognition can be imperfect, but the verifier must make the flow usable and safe.

## Coaching Scope

The app should help with Sudoku techniques, not simply reveal answers.

The first implementation should support beginner and intermediate guidance for:

1. Cross-hatching.
2. Snyder notation.
3. Naked singles.
4. Hidden singles.
5. Pointing pairs/triples.
6. Box-line reduction.
7. Naked pairs/triples.
8. Hidden pairs/triples.

The architecture should be ready for later advanced techniques:

1. X-Wing.
2. Swordfish.
3. XY-Wing.
4. Coloring.
5. Forcing chains / AIC-style reasoning.

Each hint should return:

1. Technique name.
2. Affected cells.
3. Affected candidates.
4. Explanation.
5. Suggested reasoning step.
6. Hint level, from subtle nudge to explicit candidate elimination.

Hints should guide the player toward the technique. They should not simply fill in the answer unless the user explicitly asks for a final reveal mode later.

## Data Model Expectations

Use the existing Arcade Club session architecture.

Shared session tables remain generic:

- `gameSessions`
- `sessionParticipants`

Add Sudoku-specific state separately.

Candidates and notes should be stored compactly, preferably as bitmasks per cell, so validation, hint detection, undo/redo, and syncing stay manageable.

## Routes

Add Sudoku routes consistent with the existing app structure:

1. `/sudoku/new`
   Starts a new generated Sudoku session.

2. `/sudoku/$sessionId`
   Renders the playable Sudoku board.

3. `/sudoku/scan`
   Starts scan/import flow.

4. `/sudoku/scan/verify`
   Shows the verifier before session creation, or implement this as a step inside `/sudoku/scan`.

## Acceptance Criteria

The Sudoku feature is done when:

1. `sudoku` is marked playable in the game catalog.
2. `/sudoku/new` creates a solo session.
3. `/sudoku/$sessionId` renders a playable Sudoku board.
4. `/sudoku/scan` or equivalent import flow exists.
5. Convex stores Sudoku-specific state separately from shared `gameSessions`.
6. Board state includes:
   - givens
   - placed user digits
   - corner notes
   - center notes
   - color/highlight marks
   - elapsed time
   - source
   - completion status

7. Notes work independently from final digits.

8. At least four difficulty levels load or generate uniquely solvable puzzles.

9. The player can complete a puzzle and the session is marked completed.

10. Beginner/intermediate hint detection works and returns structured explanations.

11. Scan import can recognize:

- printed givens
- handwritten full-size digits
- handwritten corner notes
- handwritten center notes
- empty cells

12. Scan verifier lets the user correct OCR/classification results before session creation.

13. Invalid scanned puzzles are blocked before play starts.

14. Tests cover:

- Sudoku rule validation
- candidate calculation
- final digit entry
- corner notes
- center notes
- color/highlight marks
- move history
- undo/redo
- completion detection
- beginner/intermediate hint detection
- scan-result validation
- verifier correction logic

15. Verification passes:

- `pnpm run check`
- `pnpm test`
- `pnpm run build`

## Out Of Scope

The first Sudoku implementation should not include:

1. Personal goals.
2. Streaks.
3. Achievements.
4. Learning plans.
5. Multiplayer races.
6. Daily puzzle calendar.
7. Ranking or leaderboard.
8. Perfect OCR accuracy without user correction.
9. Full advanced technique implementation, beyond architecture hooks.
