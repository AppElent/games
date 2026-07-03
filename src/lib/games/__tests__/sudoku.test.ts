import { describe, expect, it } from "vitest";
import {
	SUDOKU_CELL_COUNT,
	cellAt,
	computeCandidates,
	countSolutions,
	digitsInMask,
	emptyGrid,
	findConflicts,
	generatePuzzle,
	gridToString,
	isGridSolved,
	mulberry32,
	parseGrid,
	solve,
} from "../sudoku";
import {
	applyAction,
	boardConflicts,
	canRedo,
	canUndo,
	createBoardState,
	createHistory,
	deserializeBoard,
	effectiveGrid,
	isBoardComplete,
	redo,
	serializeBoard,
	undo,
} from "../sudoku-board";

const KNOWN_PUZZLE =
	"530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("sudoku rules", () => {
	it("parses and serializes grids", () => {
		const grid = parseGrid(KNOWN_PUZZLE);
		expect(grid).toHaveLength(SUDOKU_CELL_COUNT);
		expect(grid[0]).toBe(5);
		expect(grid[2]).toBe(0);
		expect(gridToString(grid)).toBe(KNOWN_PUZZLE);
	});

	it("finds row, column, and box conflicts", () => {
		const grid = emptyGrid();
		grid[cellAt(0, 0)] = 5;
		grid[cellAt(0, 8)] = 5; // same row
		grid[cellAt(8, 0)] = 5; // same column
		grid[cellAt(1, 1)] = 5; // same box
		const conflicts = findConflicts(grid);
		expect(conflicts.has(cellAt(0, 0))).toBe(true);
		expect(conflicts.has(cellAt(0, 8))).toBe(true);
		expect(conflicts.has(cellAt(8, 0))).toBe(true);
		expect(conflicts.has(cellAt(1, 1))).toBe(true);
		expect(conflicts.has(cellAt(4, 4))).toBe(false);
	});

	it("computes candidates from peers", () => {
		const grid = emptyGrid();
		grid[cellAt(0, 1)] = 1;
		grid[cellAt(1, 1)] = 2;
		grid[cellAt(5, 0)] = 3;
		const candidates = computeCandidates(grid);
		expect(digitsInMask(candidates[cellAt(0, 0)])).toEqual([
			4, 5, 6, 7, 8, 9,
		]);
		expect(candidates[cellAt(0, 1)]).toBe(0); // filled cell
	});

	it("solves a known puzzle with a unique solution", () => {
		const grid = parseGrid(KNOWN_PUZZLE);
		expect(countSolutions(grid, 2)).toBe(1);
		const solution = solve(grid);
		expect(solution).not.toBeNull();
		expect(isGridSolved(solution ?? [])).toBe(true);
		// givens preserved
		grid.forEach((value, cell) => {
			if (value !== 0) {
				expect(solution?.[cell]).toBe(value);
			}
		});
	});

	it("reports zero solutions for contradictory grids", () => {
		const grid = emptyGrid();
		grid[cellAt(0, 0)] = 1;
		grid[cellAt(0, 1)] = 1;
		expect(countSolutions(grid)).toBe(0);
		expect(solve(grid)).toBeNull();
	});
});

describe("sudoku generation", () => {
	it.each(["easy", "medium", "hard", "expert"] as const)(
		"generates a uniquely solvable %s puzzle",
		(difficulty) => {
			const rng = mulberry32(42);
			const puzzle = generatePuzzle(difficulty, rng);
			expect(countSolutions(puzzle.givens, 2)).toBe(1);
			expect(isGridSolved(puzzle.solution)).toBe(true);
			puzzle.givens.forEach((value, cell) => {
				if (value !== 0) {
					expect(puzzle.solution[cell]).toBe(value);
				}
			});
			expect(puzzle.clueCount).toBeGreaterThanOrEqual(17);
			expect(puzzle.clueCount).toBeLessThan(SUDOKU_CELL_COUNT);
		},
	);

	it("gives easier puzzles more clues", () => {
		const easy = generatePuzzle("easy", mulberry32(7));
		const expert = generatePuzzle("expert", mulberry32(7));
		expect(easy.clueCount).toBeGreaterThan(expert.clueCount);
	});
});

describe("sudoku board state", () => {
	const givens = parseGrid(KNOWN_PUZZLE);

	it("enters and toggles final digits, but never on givens", () => {
		let history = createHistory(createBoardState(givens));
		const openCell = givens.findIndex((value) => value === 0);
		history = applyAction(history, { type: "setDigit", cell: openCell, digit: 4 });
		expect(history.current.digits[openCell]).toBe(4);
		// toggle off by re-entering the same digit
		history = applyAction(history, { type: "setDigit", cell: openCell, digit: 4 });
		expect(history.current.digits[openCell]).toBe(0);
		// givens are locked
		const givenCell = givens.findIndex((value) => value !== 0);
		const before = history;
		history = applyAction(history, { type: "setDigit", cell: givenCell, digit: 9 });
		expect(history).toBe(before);
	});

	it("keeps corner and center notes independent from digits", () => {
		let history = createHistory(createBoardState(givens));
		const cell = givens.findIndex((value) => value === 0);
		history = applyAction(history, { type: "toggleCorner", cell, digit: 1 });
		history = applyAction(history, { type: "toggleCorner", cell, digit: 2 });
		history = applyAction(history, { type: "toggleCenter", cell, digit: 3 });
		expect(digitsInMask(history.current.corner[cell])).toEqual([1, 2]);
		expect(digitsInMask(history.current.center[cell])).toEqual([3]);
		expect(history.current.digits[cell]).toBe(0);
		// placing a digit clears that cell's notes
		history = applyAction(history, { type: "setDigit", cell, digit: 7 });
		expect(history.current.corner[cell]).toBe(0);
		expect(history.current.center[cell]).toBe(0);
	});

	it("auto-cleanup strips the placed digit from peer notes when enabled", () => {
		const empty = emptyGrid();
		let history = createHistory(createBoardState(empty));
		const cell = cellAt(0, 0);
		const peer = cellAt(0, 5);
		const nonPeer = cellAt(5, 5);
		history = applyAction(history, { type: "toggleCenter", cell: peer, digit: 6 });
		history = applyAction(history, {
			type: "toggleCenter",
			cell: nonPeer,
			digit: 6,
		});
		history = applyAction(
			history,
			{ type: "setDigit", cell, digit: 6 },
			{ autoCleanup: true },
		);
		expect(history.current.center[peer]).toBe(0);
		expect(digitsInMask(history.current.center[nonPeer])).toEqual([6]);
	});

	it("does not touch peer notes without auto-cleanup", () => {
		let history = createHistory(createBoardState(emptyGrid()));
		const peer = cellAt(0, 5);
		history = applyAction(history, { type: "toggleCenter", cell: peer, digit: 6 });
		history = applyAction(history, { type: "setDigit", cell: cellAt(0, 0), digit: 6 });
		expect(digitsInMask(history.current.center[peer])).toEqual([6]);
	});

	it("cycles color marks and clears on repeat", () => {
		let history = createHistory(createBoardState(givens));
		history = applyAction(history, { type: "setColor", cell: 0, color: 3 });
		expect(history.current.colors[0]).toBe(3);
		history = applyAction(history, { type: "setColor", cell: 0, color: 3 });
		expect(history.current.colors[0]).toBe(0);
	});

	it("erases digit first, then notes, then color", () => {
		let history = createHistory(createBoardState(givens));
		const cell = givens.findIndex((value) => value === 0);
		history = applyAction(history, { type: "setColor", cell, color: 2 });
		history = applyAction(history, { type: "setDigit", cell, digit: 8 });

		history = applyAction(history, { type: "erase", cell });
		expect(history.current.digits[cell]).toBe(0);
		history = applyAction(history, { type: "toggleCorner", cell, digit: 5 });
		expect(digitsInMask(history.current.corner[cell])).toEqual([5]);
		history = applyAction(history, { type: "erase", cell });
		expect(history.current.corner[cell]).toBe(0);
		expect(history.current.colors[cell]).toBe(2);
		history = applyAction(history, { type: "erase", cell });
		expect(history.current.colors[cell]).toBe(0);
	});

	it("supports undo and redo across the move history", () => {
		let history = createHistory(createBoardState(givens));
		const cell = givens.findIndex((value) => value === 0);
		expect(canUndo(history)).toBe(false);
		history = applyAction(history, { type: "setDigit", cell, digit: 1 });
		history = applyAction(history, { type: "toggleCorner", cell: cell + 1, digit: 2 });
		expect(history.past).toHaveLength(2);

		history = undo(history);
		expect(history.current.corner[cell + 1]).toBe(0);
		expect(history.current.digits[cell]).toBe(1);
		history = undo(history);
		expect(history.current.digits[cell]).toBe(0);
		expect(canUndo(history)).toBe(false);
		expect(canRedo(history)).toBe(true);

		history = redo(history);
		expect(history.current.digits[cell]).toBe(1);

		// a new action clears the redo stack
		const otherOpen = givens.findIndex(
			(value, index) => value === 0 && index > cell + 1,
		);
		history = applyAction(history, {
			type: "setDigit",
			cell: otherOpen,
			digit: 3,
		});
		expect(canRedo(history)).toBe(false);
	});

	it("restart clears everything but givens", () => {
		let history = createHistory(createBoardState(givens));
		const cell = givens.findIndex((value) => value === 0);
		history = applyAction(history, { type: "setDigit", cell, digit: 1 });
		history = applyAction(history, { type: "setColor", cell, color: 4 });
		history = applyAction(history, { type: "restart" });
		expect(history.current.digits[cell]).toBe(0);
		expect(history.current.colors[cell]).toBe(0);
		expect(history.current.givens).toEqual(givens);
		// restart is undoable
		history = undo(history);
		expect(history.current.colors[cell]).toBe(4);
	});

	it("detects completion when the merged grid is solved", () => {
		const puzzle = generatePuzzle("easy", mulberry32(11));
		const state = createBoardState(puzzle.givens);
		puzzle.givens.forEach((value, cell) => {
			if (value === 0) {
				state.digits[cell] = puzzle.solution[cell];
			}
		});
		expect(effectiveGrid(state)).toEqual(puzzle.solution);
		expect(isBoardComplete(state)).toBe(true);
		expect(boardConflicts(state).size).toBe(0);
		// break one cell — no longer complete, conflict flagged
		const cell = puzzle.givens.findIndex((value) => value === 0);
		state.digits[cell] = state.digits[cell] === 1 ? 2 : 1;
		expect(isBoardComplete(state)).toBe(false);
	});

	it("serializes and deserializes board state", () => {
		let history = createHistory(createBoardState(givens));
		const cell = givens.findIndex((value) => value === 0);
		history = applyAction(history, { type: "setDigit", cell, digit: 4 });
		history = applyAction(history, { type: "toggleCorner", cell: cell + 1, digit: 9 });
		history = applyAction(history, { type: "setColor", cell: 3, color: 5 });
		const roundTripped = deserializeBoard(serializeBoard(history.current));
		expect(roundTripped).toEqual(history.current);
	});
});
