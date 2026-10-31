/**
 * Sudoku and binary-puzzle chrome. Hint explanations come from
 * `@games/core/sudoku-hints` in English notation (R1C1) and are not routed
 * through these keys (same as the web).
 */
export const sudoku = {
	title: "Sudoku",
	difficulty: {
		easy: "Easy",
		medium: "Medium",
		hard: "Hard",
		expert: "Expert",
	},
	variant: {
		classic: "Classic",
		killer: "Killer",
		binary: "Binary",
	},
	newGame: {
		heading: "New puzzle",
		variantLabel: "Game type",
		variantBlurbs: {
			classic: "The familiar 9×9 grid.",
			killer: "Cages must add up to their sum.",
			binary: "Fill the grid with 0s and 1s.",
		},
		difficultyBlurbs: {
			easy: {
				classic: "Plenty of clues, gentle start",
				killer: "Many givens, small cages",
				binary: "6×6 grid, gentle start",
			},
			medium: {
				classic: "Singles and simple pairs",
				killer: "Fewer givens, lean on the sums",
				binary: "8×8 grid",
			},
			hard: {
				classic: "Pointing pairs and reductions",
				killer: "A handful of givens",
				binary: "10×10 grid",
			},
			expert: {
				classic: "Sparse clues, deep scanning",
				killer: "Cages only, no givens",
				binary: "10×10, sparse clues",
			},
		},
		generating: "Generating…",
		couldNotStart: "Couldn't create a puzzle. Please try again.",
		offlineNote: "Puzzles are saved on this phone and work offline.",
	},
	saved: {
		heading: "Your puzzles",
		empty: "Puzzles you start appear here so you can pick them up later.",
		solved: "Solved in {time}",
		inProgress: "{time} played",
		deleteTitle: "Delete this puzzle?",
		deleteBody: "Its progress is removed from this phone.",
	},
	board: {
		cellLabel: "Row {row}, column {col}",
		given: "given",
		empty: "empty",
		notes: "notes {digits}",
		cage: "cage sum {sum}",
		conflict: "conflict",
	},
	keypad: {
		modeLabel: "Entry mode",
		modeDigit: "Digit",
		modeCorner: "Corner",
		modeCenter: "Center",
		modeColor: "Color",
		digitLabel: "{digit}, {count} left",
		colorLabel: "Color {number}",
		undo: "Undo",
		redo: "Redo",
		erase: "Erase",
		hint: "Hint",
	},
	game: {
		timer: "Time {time}",
		pause: "Pause",
		resume: "Resume",
		paused: "Paused",
		pausedBody: "The board is hidden while the clock is stopped.",
		solvedTitle: "Solved!",
		completedIn: "Completed in {time}.",
		newPuzzle: "New puzzle",
		hintTitle: "Hint",
		dismissHint: "Dismiss",
		tellMeMore: "Tell me more",
		noHint: "No simple step found. Check your digits for mistakes.",
		autoCleanup: "Remove notes when a digit is placed",
		restart: "Restart",
		restartTitle: "Restart this puzzle?",
		restartBody: "The grid is cleared. You can still undo.",
		notFound: "This puzzle is no longer on this phone.",
	},
	binary: {
		dimensions: "Binary {size}×{size}",
		instructions:
			"Tap a cell to cycle 0 → 1 → empty. No three alike in a row, equal 0s and 1s per line, no duplicate lines.",
		remainingCells: {
			one: "{count} cell to go",
			other: "{count} cells to go",
		},
		restartBody: "The grid goes back to its givens.",
	},
};
