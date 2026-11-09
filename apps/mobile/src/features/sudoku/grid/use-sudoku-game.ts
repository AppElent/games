/**
 * One Classic or Killer puzzle in play: board history, entry mode, hint,
 * clock and status, written back to the save store on every change.
 */

import { parseGrid } from "@arcadeclub/core/sudoku";
import {
	applyAction,
	boardConflicts,
	canRedo,
	canUndo,
	createHistory,
	deserializeBoard,
	effectiveGrid,
	redo,
	type SudokuAction,
	type SudokuHistory,
	type SudokuInputMode,
	serializeBoard,
	undo,
} from "@arcadeclub/core/sudoku-board";
import { findHint, type SudokuHint } from "@arcadeclub/core/sudoku-hints";
import {
	boardConflictsWithCages,
	isBoardSolved,
} from "@arcadeclub/core/sudoku-killer";
import { useCallback, useMemo, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import {
	type PuzzleProgress,
	usePuzzleSession,
} from "../components/use-puzzle-session";
import { type GridSave, writeSudokuSave } from "../saves/sudoku-save-store";

export function useSudokuGame(save: GridSave) {
	const [history, setHistory] = useState<SudokuHistory>(() =>
		createHistory(deserializeBoard(save.board)),
	);
	const [mode, setMode] = useState<SudokuInputMode>("digit");
	const [selectedCell, setSelectedCell] = useState<number | null>(null);
	const [autoCleanup, setAutoCleanup] = useState(save.autoCleanup);
	const [hint, setHint] = useState<SudokuHint | null>(null);
	const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
	const [noHint, setNoHint] = useState(false);
	// Every board or option change is written, with the clock alongside.
	const write = useCallback(
		(progress: PuzzleProgress) =>
			writeSudokuSave({
				...save,
				...progress,
				board: serializeBoard(history.current),
				autoCleanup,
				updatedAt: Date.now(),
			}),
		[save, history, autoCleanup],
	);
	const session = usePuzzleSession(save, write);
	const { statusRef, complete } = session;

	const board = history.current;
	const cages = save.cages;
	const solution = useMemo(() => parseGrid(save.solution), [save.solution]);

	const conflicts = useMemo(
		() => boardConflictsWithCages(board, cages),
		[board, cages],
	);

	const digitCounts = useMemo(() => {
		const counts = new Array<number>(10).fill(0);
		for (const value of effectiveGrid(board)) counts[value] += 1;
		return counts;
	}, [board]);

	const solved = useCallback(
		(next: SudokuHistory) => isBoardSolved(next.current, cages),
		[cages],
	);

	const commit = useCallback(
		(next: SudokuHistory, previous: SudokuHistory) => {
			if (next === previous) return;
			setHistory(next);
			setHint(null);
			setNoHint(false);
			if (solved(next)) {
				complete();
				setSelectedCell(null);
				haptics.gameWon();
			}
		},
		[solved, complete],
	);

	const dispatch = useCallback(
		(action: SudokuAction) => {
			if (statusRef.current !== "active") return;
			const next = applyAction(history, action, { autoCleanup });
			if (next === history) {
				haptics.moveRejected();
				return;
			}
			const before = effectiveGrid(history.current);
			commit(next, history);
			if (action.type === "setDigit") {
				const after = effectiveGrid(next.current);
				const placed =
					after[action.cell] !== before[action.cell] &&
					after[action.cell] !== 0;
				const conflicting =
					placed && boardConflicts(next.current).has(action.cell);
				if (conflicting) haptics.moveRejected();
				else haptics.valueEntered();
			} else {
				haptics.selectionChanged();
			}
		},
		[history, autoCleanup, commit, statusRef],
	);

	const enter = useCallback(
		(digit: number) => {
			if (selectedCell === null) return;
			if (mode === "digit")
				dispatch({ type: "setDigit", cell: selectedCell, digit });
			else if (mode === "corner")
				dispatch({ type: "toggleCorner", cell: selectedCell, digit });
			else if (mode === "center")
				dispatch({ type: "toggleCenter", cell: selectedCell, digit });
		},
		[selectedCell, mode, dispatch],
	);

	const mark = useCallback(
		(color: number) => {
			if (selectedCell !== null)
				dispatch({ type: "setColor", cell: selectedCell, color });
		},
		[selectedCell, dispatch],
	);

	const erase = useCallback(() => {
		if (selectedCell !== null) dispatch({ type: "erase", cell: selectedCell });
	}, [selectedCell, dispatch]);

	const stepBack = useCallback(() => {
		if (statusRef.current !== "active") return;
		commit(undo(history), history);
		haptics.selectionChanged();
	}, [history, commit, statusRef]);

	const stepForward = useCallback(() => {
		if (statusRef.current !== "active") return;
		commit(redo(history), history);
		haptics.selectionChanged();
	}, [history, commit, statusRef]);

	const restart = useCallback(() => dispatch({ type: "restart" }), [dispatch]);

	const requestHint = useCallback(() => {
		if (statusRef.current !== "active") return;
		if (hint) {
			setHintLevel((level) => (level < 3 ? ((level + 1) as 2 | 3) : level));
			return;
		}
		const found = findHint(effectiveGrid(history.current), {
			solution,
			givens: history.current.givens,
		});
		setHint(found);
		setHintLevel(1);
		setNoHint(!found);
	}, [hint, history, solution, statusRef]);

	const hintCells = useMemo(() => {
		if (!hint || hintLevel === 1) return undefined;
		const cells = new Set(hint.cells);
		if (hintLevel === 3) {
			for (const entry of hint.eliminations) cells.add(entry.cell);
			for (const entry of hint.placements) cells.add(entry.cell);
		}
		return cells;
	}, [hint, hintLevel]);

	const selectCell = useCallback((cell: number) => {
		setSelectedCell((current) => (current === cell ? null : cell));
		haptics.selectionChanged();
	}, []);

	return {
		board,
		cages,
		session,
		mode,
		setMode,
		selectedCell,
		selectCell,
		conflicts,
		digitCounts,
		hint,
		hintLevel,
		hintCells,
		noHint,
		dismissHint: () => {
			setHint(null);
			setNoHint(false);
		},
		requestHint,
		autoCleanup,
		setAutoCleanup,
		enter,
		mark,
		erase,
		undo: stepBack,
		redo: stepForward,
		canUndo: canUndo(history),
		canRedo: canRedo(history),
		restart,
	};
}
