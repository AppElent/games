import type { SudokuInputMode } from "../../../sudoku-board";
import type { HintTechniqueLevel } from "../../../sudoku-hints";
import type { CornerNoteLayout, SudokuCycleMode } from "../../../sudoku-input";

/** Sudoku + binary-puzzle copy, including the hint templates that
 * `describeHint` in sudoku-hints.ts fills. */
export const sudoku = {
	hints: {
		cell: "R{row}C{col}",
		row: "row {n}",
		column: "column {n}",
		box: "box {n}",
		pair: "pair",
		triple: "triple",
		quad: "quad",
		rows: "rows {list}",
		columns: "columns {list}",
		and: " and ",
		afterEarlierHints:
			" This counts the candidates that earlier hints already removed.",
		mistake: {
			title: "Mistake",
			nudge:
				"Something on the board doesn't add up. Take another look at {unit}.",
			direction: "One of your digits is wrong: check {cell}.",
			explanation:
				"The {digit} in {cell} doesn't belong there. Erase it, then ask for the next step.",
		},
		nakedSingle: {
			title: "Naked single",
			nudge: "Take a close look at {cell}. How many digits can still go there?",
			direction:
				"There is a naked single in {unit}: a cell where every digit but one is ruled out.",
			explanation:
				"{cell} has only one candidate left: {digit}. Every other digit already appears in its row, column or box, so {digit} goes there.",
		},
		hiddenSingle: {
			title: "Hidden single",
			nudge: "Scan {unit}: one digit has only a single place left there.",
			direction:
				"There is a hidden single for {digit} in {unit}. Cross-hatch to find the only cell that can take it.",
			explanation:
				"Within {unit}, {digit} can only go in {cell}: every other cell already sees a {digit} in its row, column or box.",
			crossHatch:
				" Cross-hatching the box (scanning the rows and columns through it) shows this.",
		},
		pointing: {
			title: "Pointing {set}",
			nudge:
				"Look at where {digit} can go inside {box}. Notice anything about the shape?",
			direction:
				"There is a pointing {set} in {box}: all its {digit} candidates lie in {line}, which limits the rest of that line.",
			explanation:
				"In {box}, {digit} is confined to {cells}, all in {line}. Wherever it lands, {line} gets its {digit} from this box, so {digit} can be removed from {eliminated}.",
		},
		boxLine: {
			title: "Box-line reduction",
			nudge:
				"Check where {digit} can go in {line}. The options cluster together.",
			direction:
				"Box-line reduction in {line}: its {digit} candidates all sit in {box}.",
			explanation:
				"In {line}, {digit} can only go in {cells}, all inside {box}. The box must take its {digit} from that line, so {digit} can be removed from {eliminated}.",
		},
		nakedSet: {
			title: "Naked {set}",
			nudge:
				"Compare the candidates in {unit}. Some cells share exactly the same few digits.",
			direction:
				"There is a naked {set} in {unit}: {size} cells that allow only the same {size} digits.",
			explanation:
				"In {unit}, the cells {cells} allow only {digits}. Those digits must fill exactly those cells, so they can be removed from every other cell in {unit}.",
		},
		hiddenSet: {
			title: "Hidden {set}",
			nudge:
				"In {unit}, track where {digits} can still go. The options overlap.",
			direction:
				"There is a hidden {set} in {unit}: {digits} fit only in the same {size} cells.",
			explanation:
				"In {unit}, {digits} can only go in {cells}. Those cells are reserved for them, so every other candidate can be removed from them.",
		},
		snyder: {
			title: "Snyder notation",
			nudge: "Worth annotating: in {box}, one digit is down to two places.",
			direction:
				"Use Snyder notation in {box}: mark the two possible cells for {digit} with corner notes.",
			explanation:
				"In {box}, {digit} can only go in {cells}. Mark both with a corner note {digit}. When one is ruled out later, the other is certain.",
		},
		fish: {
			xWing: "X-Wing",
			swordfish: "Swordfish",
			anXWing: "an X-Wing",
			aSwordfish: "a Swordfish",
			jellyfish: "Jellyfish",
			aJellyfish: "a Jellyfish",
			title: "{fish}",
			nudge:
				"Follow {digit} through {base}. In each, it has only a few places left.",
			direction:
				"There is {aFish} on {digit}: in {base}, it can only go in {cover}.",
			explanation:
				"In {base}, {digit} can only go in {cells}, all within {cover}. Each of {base} takes its {digit} in one of these cells, so {cover} get theirs there too, and {digit} can be removed from {eliminated}.",
		},
		skyscraper: {
			title: "Skyscraper",
			nudge: "Look at {digit} in {base}: in each, it has exactly two places.",
			direction:
				"There is a Skyscraper on {digit} in {base}: two strong links that stand on the same line.",
			explanation:
				"In {base}, {digit} has only two places each. {shared} line up, so at most one of them is {digit}, and at least one of {ends} must be. {digit} can be removed from every cell that sees both: {eliminated}.",
		},
		twoStringKite: {
			title: "2-String Kite",
			nudge: "Find where {digit} has exactly two places in {base}.",
			direction:
				"There is a 2-String Kite on {digit}: a strong link in each of {base}, joined in {box}.",
			explanation:
				"In {base}, {digit} has only two places each. {shared} sit in {box}, so at most one of them is {digit}, and at least one of {ends} must be. {digit} can be removed from every cell that sees both: {eliminated}.",
		},
		xyWing: {
			title: "XY-Wing",
			nudge: "Look at the cells with only two candidates around {pivot}.",
			direction:
				"There is an XY-Wing with its pivot in {pivot}: its two wings share a {z}.",
			explanation:
				"{pivot} is {x} or {y}. If it is {x}, {wingX} must be {z}; if it is {y}, {wingY} must be {z}. Either way one wing holds the {z}, so {z} can be removed from every cell that sees both wings: {eliminated}.",
		},
		xyzWing: {
			title: "XYZ-Wing",
			nudge: "Look at {pivot} and the two-candidate cells it sees.",
			direction:
				"There is an XYZ-Wing with its pivot in {pivot}: the pivot and both wings allow {z}.",
			explanation:
				"{pivot} allows {x}, {y} and {z}; {wings} each allow {z} and one of the others. Whatever goes in the pivot, one of the three cells is {z}, so {z} can be removed from every cell that sees all three: {eliminated}.",
		},
		wWing: {
			title: "W-Wing",
			nudge:
				"{wings} allow the same two digits, {digits}. Look for a link between them.",
			direction: "There is a W-Wing on {wings}, linked by {x} in {base}.",
			explanation:
				"In {base}, {x} can only go in {link}. If neither of {wings} were {y}, both would be {x}, leaving {base} without a place for {x}. So one of them is {y}, and {y} can be removed from every cell that sees both: {eliminated}.",
		},
		uniqueRectangle: {
			title: "Unique rectangle",
			nudge:
				"Four cells in two boxes almost share the same two candidates. A puzzle with one solution can't allow that.",
			direction: "There is a unique rectangle on {digits} in {cells}.",
			explanation:
				"{floor} allow only {digits}. If {target} could only be {x} or {y} as well, the four cells could swap those digits and the puzzle would have two solutions. It has one, so {digits} can be removed from {target}.",
		},
		bugPlusOne: {
			title: "BUG+1",
			nudge:
				"Almost every open cell is down to two candidates. One cell is the exception.",
			direction:
				"This is a BUG+1: every open cell has two candidates except {cell}.",
			explanation:
				"If {cell} lost {digit}, every digit would have exactly two places in each row, column and box: a pattern that never has a single solution. So {digit} goes in {cell}.",
		},
		colorTrap: {
			title: "Simple coloring",
			nudge:
				"Follow {digit} through the rows, columns and boxes where it has only two places.",
			direction:
				"Colour the cells where {digit} has only two places: the colour switches along each link, and one colour holds every {digit}.",
			explanation:
				"Each link is a row, column or box where {digit} has only two places, so one cell of it is {digit} and the other is not. Following the links, either {colorA} or {colorB} are all {digit}. {eliminated} see a cell of each colour, so {digit} can be removed there.",
		},
		colorWrap: {
			title: "Simple coloring",
			nudge:
				"Follow {digit} through the rows, columns and boxes where it has only two places.",
			direction:
				"Colour the cells where {digit} has only two places: two cells of the same colour meet.",
			explanation:
				"Each link is a row, column or box where {digit} has only two places, so the colour switches along it and one colour holds every {digit}. {clash} have the same colour and see each other, so they can't both be {digit}: that colour is wrong. {digit} can be removed from all of it: {eliminated}.",
		},
		xChain: {
			title: "X-Chain",
			nudge: "Follow {digit} from {start} along cells that link to each other.",
			direction: "There is an X-Chain on {digit} from {start} to {end}.",
			explanation:
				"Along {chain}, the links alternate: a row, column or box where {digit} has only two places, then two cells that see each other. If {start} isn't {digit}, the chain forces {end} to be {digit}. So one of the ends is {digit}, and {digit} can be removed from every cell that sees both: {eliminated}.",
		},
		xyChain: {
			title: "XY-Chain",
			nudge:
				"Look for a chain of two-candidate cells that starts and ends with {digit}.",
			direction:
				"There is an XY-Chain from {start} to {end}: both ends allow {digit}.",
			explanation:
				"{chain} each allow two digits, and each sees the next one. If {start} isn't {digit}, it holds its other digit, which pushes each next cell to its other digit, until {end} is {digit}. So one of the ends is {digit}, and {digit} can be removed from every cell that sees both: {eliminated}.",
		},
		alsXz: {
			title: "ALS-XZ",
			nudge:
				"Look for two groups of cells that each allow one digit more than they have cells.",
			direction: "There is an ALS-XZ on {alsA} and {alsB}, linked by {x}.",
			explanation:
				"{alsA} and {alsB} each allow one digit more than they have cells. Every {x} in one group sees every {x} in the other, so at most one group holds {x}. A group without {x} must hold all its other digits, {z} among them, so one of the groups holds {z}, and {z} can be removed from every cell that sees all of their {z}s: {eliminated}.",
		},
		revealCell: {
			title: "Reveal a cell",
			nudge: "None of the techniques the app knows finds the next step here.",
			direction:
				"The app can't find a step it can explain, so it reveals one cell for you.",
			explanation:
				"{cell} is {digit}. This comes from the solution, not from a technique, so it is the one hint that doesn't explain why.",
		},
	},
	saved: {
		empty: "Puzzles you start appear here so you can pick them up later.",
		solved: "Solved in {time}",
		inProgress: "{time} played",
		deleteTitle: "Delete this puzzle?",
		deleteBody: "Its progress is removed from this device.",
		solvedOnAccount: "Solved",
		inProgressOnAccount: "In progress",
		waitingToSync: "Waiting to sync",
		removeTitle: "Remove this puzzle from the list?",
		removeAccountBody: "It stays in your account, and on the web.",
	},
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
	board: {
		cellLabel: "Row {row}, column {col}",
		given: "given",
		empty: "empty",
		notes: "notes {digits}",
		cage: "cage sum {sum}",
		conflict: "conflict",
		retapHint: "Tap again to switch entry mode. Press and hold to deselect",
		deselectHint: "Press and hold to deselect",
		deselectAction: "Deselect",
	},
	keypad: {
		modeLabel: "Entry mode",
		digitLabel: "{digit}, {count} left",
		modes: {
			digit: "Digit",
			corner: "Corner",
			center: "Center",
			color: "Color",
		} satisfies Record<SudokuInputMode, string>,
		colorAriaLabel: "Color {number}",
		modeAnnouncement: "Entry mode: {mode}",
		undo: "Undo",
		redo: "Redo",
		erase: "Erase",
		hint: "Hint",
	},
	inputSettings: {
		title: "Settings",
		hintsHeading: "Hints",
		inputHeading: "Input",
		hintsUpToLabel: "Hints go up to",
		hintLevels: {
			beginner: "Basic",
			intermediate: "Intermediate",
			advanced: "Advanced",
			expert: "Expert",
		} satisfies Record<HintTechniqueLevel, string>,
		hintLevelNotes: {
			beginner: "Singles only",
			intermediate: "Adds pairs, triples and pointing",
			advanced: "Adds X-Wing, Swordfish, wings and unique rectangles",
			expert: "Adds chains, coloring and Jellyfish, then reveals a cell",
		} satisfies Record<HintTechniqueLevel, string>,
		showHintLevel: "Show the level on each hint",
		tapCycleLabel: "Tapping the selected cell again switches to",
		tapCycleNote: "Digit is always included.",
		tapCycleSwitchLabel: "{mode} in the tap cycle",
		modes: {
			corner: "Corner notes",
			center: "Center notes",
			color: "Colors",
		} satisfies Record<SudokuCycleMode, string>,
		cornerLayoutLabel: "Corner note position",
		cornerLayouts: {
			spread: "All corners",
			topRight: "Top right",
		} satisfies Record<CornerNoteLayout, string>,
	},
	game: {
		timer: "Time {time}",
		pausedBody: "The board is hidden while the clock is stopped.",
		noHint: "No simple step found. Check your digits for mistakes.",
		restartTitle: "Restart this puzzle?",
		restartBody: "The grid is cleared. You can still undo.",
		renameTooltip: "Rename this puzzle",
		importedFallback: "Imported",
		scannedLabel: "scanned",
		solvedTitle: "Solved! 🎉",
		completedIn: "Completed in {time}.",
		startAnotherPuzzle: "Start another puzzle",
		pausedOverlay: "Paused — tap to resume",
		pauseButton: "Pause",
		hintFallbackTitle: "Hint",
		dismissHint: "Dismiss",
		tellMeMore: "Tell me more",
		hintAboveMax: "The next step needs {needed}. Your hints go up to {max}.",
		hintNeeds: {
			beginner: "a basic technique",
			intermediate: "an intermediate technique",
			advanced: "an advanced technique",
			expert: "an expert technique",
		} satisfies Record<HintTechniqueLevel, string>,
		hintMax: {
			beginner: "basic",
			intermediate: "intermediate",
			advanced: "advanced",
			expert: "expert",
		} satisfies Record<HintTechniqueLevel, string>,
		showHintAnyway: "Show it anyway",
		autoCleanupLabel: "Auto-remove notes when a digit is placed",
		restartConfirm:
			"Restart this puzzle? Your progress is kept in undo history.",
		keyboardHelp:
			"Keyboard: 1-9 digits · Shift+digit corner note · Ctrl+digit center note · Space cycles mode · Ctrl+Z/Y undo/redo · arrows move · Esc deselects",
	},
	binary: {
		restartBody: "The grid goes back to its givens.",
		dimensions: "Binary {size}×{size}",
		restartConfirm: "Restart this puzzle?",
		instructions:
			"Tap a cell to cycle 0 → 1 → empty. No three alike in a row, equal 0s and 1s per line, no duplicate lines.",
		remainingCells: {
			one: "{count} cell to go",
			other: "{count} cells to go",
		},
	},
	scan: {
		pageHeading: "Scan a paper puzzle",
		couldNotReadImage: "Could not read the image",
		recognitionFailed: "Recognition failed",
		preparingImage: "Preparing image...",
		readingCells: "Reading cells {done}/{total}...",
		correctedGridAlt: "Corrected sudoku grid",
		uploadInstructions:
			"Photograph or upload a printed sudoku — including one you already started solving on paper. You will verify the recognized grid before playing.",
		takePhoto: "Take a photo",
		choosePhoto: "Choose a photo",
		photoInstructions:
			"Photograph a printed sudoku or choose a photo of one — including one you already started on paper. You check the recognized grid before playing.",
		entryBlurb: "Photograph a puzzle from a newspaper or book.",
		cameraDenied: "Allow camera access in Settings to take a photo.",
		scannedTitle: "Scanned puzzle",
		uploadImage: "Upload an image",
		findingGrid: "Finding the grid...",
		dragCorners: "Drag the four handles onto the corners of the sudoku grid.",
		cornerKeyboardHint:
			"With the keyboard, Tab to a handle and press the arrow keys to move it. Hold Shift for bigger steps.",
		uploadedImageAlt: "Uploaded sudoku",
		cornerHandle: "Corner {number}",
		readGrid: "Read this grid",
		scannedImageLabel: "Scanned image",
		recognizedGridLabel: "Recognized grid — tap a cell to correct it",
		lowConfidenceHighlighted: {
			one: "{count} low-confidence cell highlighted in amber.",
			other: "{count} low-confidence cells highlighted in amber.",
		},
		allConfident:
			"All recognitions look confident — still, double-check before starting.",
		cellLabel: "Cell R{row}C{col}",
		verifyCellName: "Row {row}, column {col}: {value}",
		verifyCellEmpty: "empty",
		verifyCellUnknown: "unreadable digit",
		verifyCellNotes: "{type} {digits}",
		lowConfidenceBadge: "low confidence",
		cellTypeGiven: "Given",
		cellTypeUserDigit: "Your digit",
		cellTypeCornerNotes: "Corner notes",
		cellTypeCenterNotes: "Center notes",
		cellTypeEmpty: "Empty",
		clearCell: "Clear cell",
		previewLabel: "Preview — exactly how the puzzle will start",
		validation: {
			conflict: "Some digits conflict in a row, column, or box.",
			tooFewGivens: {
				one: "Only {count} given recognized — a valid Sudoku needs at least {min}.",
				other:
					"Only {count} givens recognized — a valid Sudoku needs at least {min}.",
			},
			noSolution: "The recognized givens have no solution.",
			userDigitsIncompatible:
				"The handwritten digits are not compatible with any solution of the givens.",
		},
		multipleSolutionsWarning:
			"The givens allow more than one solution. You can still play, but consider double-checking for missed digits.",
		uniqueSolution: "Looks good: the givens define a unique solution.",
		startOver: "Start over",
		creatingPuzzle: "Creating puzzle...",
		confirmAndPlay: "Confirm and play",
		couldNotCreateSession: "Could not create session",
		killer: {
			readingSums: "Reading cage sums {done}/{total}...",
			gridLabel: "Recognized cages — tap a cell to correct its cage",
			cellName: "Row {row}, column {col}: cage of {count}, sum {sum}",
			cellNameNoSum: "Row {row}, column {col}: cage of {count}, no sum yet",
			cellNameUnsure:
				"Row {row}, column {col}: cage of {count}, sum {sum}, read with doubt",
			unsureLines: {
				one: "{count} unsure cage line is marked in amber. Compare it with the photo.",
				other:
					"{count} unsure cage lines are marked in amber. Compare them with the photo.",
			},
			allLinesSure:
				"Every cage line read clearly. Still, compare the cages with the photo.",
			unsureSums: {
				one: "{count} sum read with doubt is outlined in amber.",
				other: "{count} sums read with doubt are outlined in amber.",
			},
			cageLabel: {
				one: "Cage of {count} cell",
				other: "Cage of {count} cells",
			},
			sumLabel: "Sum",
			sumHint: "A whole number from 1 to 45.",
			linesLabel: "Cage lines around this cell",
			lineUp: "Line above",
			lineRight: "Line right",
			lineDown: "Line below",
			lineLeft: "Line left",
			unsure: "unsure",
			missingSums: {
				one: "{count} cage has no sum yet.",
				other: "{count} cages have no sum yet.",
			},
			invalidCages:
				"A cage cannot be right: it has more than 9 cells, or a sum its cells cannot make.",
			total: "The sums add up to {total}; a Killer's sums add up to 405.",
			noSolution:
				"These cages and sums have no solution. Compare the sums and lines with the photo.",
			manySolutions:
				"These cages and sums allow more than one solution. Compare the sums and lines with the photo.",
			readAsClassic: "Not a Killer? Read it as a classic sudoku",
			ready: "Cages and sums add up to 405.",
		},
	},
	newGame: {
		heading: "Start a puzzle",
		intro:
			"Pick a difficulty and play solo. Your progress saves automatically, and you can keep several puzzles going at once.",
		nameLabel: "Puzzle name (optional)",
		namePlaceholder: "Auto-named by level and time",
		gameTypeLegend: "Game type",
		variantBlurbs: {
			classic: "The familiar 9×9 grid",
			killer: "Cages must add up to their sum",
			binary: "Fill the grid with 0s and 1s",
		},
		offlineNote: "Puzzles are saved on this device and work offline.",
		syncNote:
			"Puzzles work offline and sync to your account, so they are on the web too.",
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
				killer: "Cages only — no givens",
				binary: "10×10, sparse clues",
			},
		},
		generating: "Generating...",
		scanInstead: "Scan a paper puzzle instead",
		yourPuzzles: "Your puzzles",
		removeFromList: "Remove {title} from this list",
		couldNotStart: "Could not start the puzzle",
	},
	session: {
		loadingPuzzle: "Loading puzzle...",
		puzzleNotFound: "Puzzle not found.",
		offline: "Connect to the internet to open this puzzle.",
	},
};
