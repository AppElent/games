/**
 * One binary puzzle in play. Entries cycle empty → 0 → 1 → empty (encoded
 * 0 → 1 → 2, see `@arcadeclub/core/binary-puzzle`); givens never change.
 */
import {
	findBinaryConflicts,
	isBinarySolved,
	nextBinaryCell,
	parseBinaryGrid,
} from "@arcadeclub/core/binary-puzzle";
import { digitsToString } from "@arcadeclub/core/puzzle";
import { useCallback, useMemo, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import {
	type PuzzleProgress,
	usePuzzleSession,
} from "../components/use-puzzle-session";
import { type BinarySave, writeSudokuSave } from "../saves/sudoku-save-store";

const UNDO_DEPTH = 100;

export function useBinaryGame(save: BinarySave) {
	const size = save.size;
	const givens = useMemo(
		() => parseBinaryGrid(save.givens, size),
		[save.givens, size],
	);
	const [entries, setEntries] = useState(() =>
		parseBinaryGrid(save.entries, size),
	);
	const [undoStack, setUndoStack] = useState<number[][]>([]);
	const write = useCallback(
		(progress: PuzzleProgress) =>
			writeSudokuSave({
				...save,
				...progress,
				entries: digitsToString(entries),
				updatedAt: Date.now(),
			}),
		[save, entries],
	);
	const session = usePuzzleSession(save, write);
	const { statusRef, complete } = session;

	const merged = useMemo(
		() => givens.map((given, cell) => (given !== 0 ? given : entries[cell])),
		[givens, entries],
	);
	const conflicts = useMemo(
		() => findBinaryConflicts(merged, size),
		[merged, size],
	);
	const remaining = merged.filter((value) => value === 0).length;

	const replace = useCallback(
		(next: number[]) => {
			setUndoStack((stack) => [...stack.slice(-(UNDO_DEPTH - 1)), entries]);
			setEntries(next);
			const nextMerged = givens.map((given, cell) =>
				given !== 0 ? given : next[cell],
			);
			if (isBinarySolved(nextMerged, size)) {
				complete();
				haptics.gameWon();
			}
		},
		[entries, givens, size, complete],
	);

	const cycle = useCallback(
		(cell: number) => {
			if (statusRef.current !== "active") return;
			if (givens[cell] !== 0) {
				haptics.moveRejected();
				return;
			}
			const next = [...entries];
			next[cell] = nextBinaryCell(entries[cell]);
			replace(next);
			haptics.selectionChanged();
		},
		[entries, givens, replace, statusRef],
	);

	const undo = useCallback(() => {
		if (statusRef.current !== "active") return;
		const previous = undoStack.at(-1);
		if (!previous) return;
		setUndoStack(undoStack.slice(0, -1));
		setEntries(previous);
		haptics.selectionChanged();
	}, [undoStack, statusRef]);

	const restart = useCallback(() => {
		if (statusRef.current !== "active") return;
		replace(new Array<number>(size * size).fill(0));
	}, [replace, size, statusRef]);

	return {
		size,
		givens,
		merged,
		conflicts,
		remaining,
		session,
		cycle,
		undo,
		canUndo: undoStack.length > 0,
		restart,
	};
}
