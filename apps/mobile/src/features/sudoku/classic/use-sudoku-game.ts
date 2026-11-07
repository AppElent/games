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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { useGameClock } from "../components/use-game-clock";
import {
	type GridSave,
	type SudokuStatus,
	writeSudokuSave,
} from "../saves/sudoku-save-store";

const ELAPSED_SAVE_EVERY = 15;

export function useSudokuGame(save: GridSave) {
	const [history, setHistory] = useState<SudokuHistory>(() =>
		createHistory(deserializeBoard(save.board)),
	);
	const [status, setStatus] = useState<SudokuStatus>(
		save.status === "completed" ? "completed" : "active",
	);
	const [mode, setMode] = useState<SudokuInputMode>("digit");
	const [selectedCell, setSelectedCell] = useState<number | null>(null);
	const [autoCleanup, setAutoCleanup] = useState(save.autoCleanup);
	const [hint, setHint] = useState<SudokuHint | null>(null);
	const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
	const [noHint, setNoHint] = useState(false);
	const statusRef = useRef(status);
	statusRef.current = status;

	const pause = useCallback(() => {
		if (statusRef.current === "active") setStatus("paused");
	}, []);
	const { elapsed, elapsedRef } = useGameClock({
		initialSeconds: save.elapsedSeconds,
		running: status === "active",
		onAway: pause,
	});

	const board = history.current;
	const cages = save.cages;
	const solution = useMemo(() => parseGrid(save.solution), [save.solution]);

	const persist = useCallback(() => {
		writeSudokuSave({
			...save,
			board: serializeBoard(history.current),
			status: statusRef.current,
			elapsedSeconds: elapsedRef.current,
			autoCleanup,
			updatedAt: Date.now(),
		});
	}, [save, history, autoCleanup, elapsedRef]);

	// Every board, status or option change; the clock is written alongside.
	// biome-ignore lint/correctness/useExhaustiveDependencies: status is read through its ref
	useEffect(() => {
		persist();
	}, [persist, status]);
	// Leaving the screen unmounts it before the blur-pause can re-render, so
	// the final clock reading is written here.
	const persistRef = useRef(persist);
	persistRef.current = persist;
	useEffect(() => () => persistRef.current(), []);
	useEffect(() => {
		if (
			status === "active" &&
			elapsed > 0 &&
			elapsed % ELAPSED_SAVE_EVERY === 0
		) {
			persist();
		}
	}, [elapsed, status, persist]);

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
				setStatus("completed");
				setSelectedCell(null);
				haptics.gameWon();
			}
		},
		[solved],
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
		[history, autoCleanup, commit],
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
	}, [history, commit]);

	const stepForward = useCallback(() => {
		if (statusRef.current !== "active") return;
		commit(redo(history), history);
		haptics.selectionChanged();
	}, [history, commit]);

	const restart = useCallback(() => {
		if (statusRef.current === "completed") return;
		dispatch({ type: "restart" });
	}, [dispatch]);

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
	}, [hint, history, solution]);

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
		status,
		elapsed,
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
		pause,
		resume: () => {
			if (statusRef.current === "paused") setStatus("active");
		},
	};
}
