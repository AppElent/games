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
import {
	findHint,
	type HintHistory,
	hintHighlights,
	rememberHint,
	type SudokuHint,
} from "@arcadeclub/core/sudoku-hints";
import {
	nextTapMode,
	type SudokuInputSettings,
	tapCell,
} from "@arcadeclub/core/sudoku-input";
import {
	boardConflictsWithCages,
	isBoardSolved,
} from "@arcadeclub/core/sudoku-killer";
import { useCallback, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	type PuzzleProgress,
	usePuzzleSession,
} from "../components/use-puzzle-session";
import { type GridSave, writeSudokuSave } from "../saves/sudoku-save-store";

export function useSudokuGame(
	save: GridSave,
	inputSettings: SudokuInputSettings,
) {
	const { t } = useI18n();
	const keypadCopy = t.games.sudoku.keypad;
	const [history, setHistory] = useState<SudokuHistory>(() =>
		createHistory(deserializeBoard(save.board)),
	);
	const [mode, setMode] = useState<SudokuInputMode>("digit");
	const [selectedCell, setSelectedCell] = useState<number | null>(null);
	const [autoCleanup, setAutoCleanup] = useState(save.autoCleanup);
	const [hint, setHint] = useState<SudokuHint | null>(null);
	const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
	const [noHint, setNoHint] = useState(false);
	// Eliminations of hints explained in full, so the next hint moves on.
	const hintHistory = useRef<HintHistory>([]);
	// The board the shown hint was found on.
	const hintGrid = useRef<number[]>([]);
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
	// A puzzle from the account has none: hints then find mistakes by rule.
	const solution = useMemo(
		() => (save.solution ? parseGrid(save.solution) : undefined),
		[save.solution],
	);

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
		if (hint?.aboveMaxLevel) {
			setHint({ ...hint, aboveMaxLevel: undefined });
			return;
		}
		if (hint) {
			if (hintLevel === 2) {
				hintHistory.current = rememberHint(
					hintHistory.current,
					hintGrid.current,
					hint,
				);
			}
			setHintLevel((level) => (level < 3 ? ((level + 1) as 2 | 3) : level));
			return;
		}
		const grid = effectiveGrid(history.current);
		hintGrid.current = grid;
		const found = findHint(grid, {
			solution,
			givens: history.current.givens,
			history: hintHistory.current,
			cages,
			maxLevel: inputSettings.hintsUpTo,
		});
		setHint(found);
		setHintLevel(1);
		setNoHint(!found);
	}, [
		hint,
		hintLevel,
		history,
		solution,
		cages,
		statusRef,
		inputSettings.hintsUpTo,
	]);

	const highlights = useMemo(
		() => hintHighlights(hint, hintLevel),
		[hint, hintLevel],
	);

	// What a cell press reads at event time. Kept in a ref so `selectCell`
	// stays the same function and the memoized cells don't all re-render.
	const latest = useRef({ selectedCell, mode, inputSettings, keypadCopy });
	latest.current = { selectedCell, mode, inputSettings, keypadCopy };
	// When the selected cell was last picked or switched mode, so a quick
	// double tap only does one of them.
	const selectedAt = useRef(0);

	/** A press on the selected cell steps to the next mode in the tap cycle. */
	const selectCell = useCallback(
		(cell: number) => {
			const current = latest.current;
			const { action, selection } = tapCell(
				{ cell: current.selectedCell, selectedAt: selectedAt.current },
				cell,
				Date.now(),
			);
			selectedAt.current = selection.selectedAt;
			if (action === "select") {
				// Updated in place too, so a second tap that lands before the
				// re-render still counts as a tap on the selected cell.
				current.selectedCell = cell;
				setSelectedCell(cell);
				haptics.selectionChanged();
				return;
			}
			if (action === "none" || statusRef.current !== "active") return;
			const next = nextTapMode(current.mode, current.inputSettings);
			if (next === current.mode) return;
			current.mode = next;
			setMode(next);
			haptics.selectionChanged();
			AccessibilityInfo.announceForAccessibility(
				fmt(current.keypadCopy.modeAnnouncement, {
					mode: current.keypadCopy.modes[next],
				}),
			);
		},
		[statusRef],
	);

	/** A press and hold on the selected cell lets go of it: a tap now switches mode. */
	const deselect = useCallback(() => {
		if (latest.current.selectedCell === null) return;
		latest.current.selectedCell = null;
		setSelectedCell(null);
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
		deselect,
		conflicts,
		digitCounts,
		hint,
		hintLevel,
		hintCells: highlights?.cells,
		hintLines: highlights?.lines,
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
