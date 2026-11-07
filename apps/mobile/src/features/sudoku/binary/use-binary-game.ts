/**
 * One binary puzzle in play. Entries cycle empty → 0 → 1 → empty (encoded
 * 0 → 1 → 2, see `@arcadeclub/core/binary-puzzle`); givens never change.
 */
import {
	findBinaryConflicts,
	isBinarySolved,
	parseBinaryGrid,
} from "@arcadeclub/core/binary-puzzle";
import { digitsToString } from "@arcadeclub/core/puzzle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { useGameClock } from "../components/use-game-clock";
import {
	type BinarySave,
	type SudokuStatus,
	writeSudokuSave,
} from "../saves/sudoku-save-store";

const UNDO_DEPTH = 100;
const ELAPSED_SAVE_EVERY = 15;

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
	const [status, setStatus] = useState<SudokuStatus>(
		save.status === "completed" ? "completed" : "active",
	);
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

	const merged = useMemo(
		() => givens.map((given, cell) => (given !== 0 ? given : entries[cell])),
		[givens, entries],
	);
	const conflicts = useMemo(
		() => findBinaryConflicts(merged, size),
		[merged, size],
	);
	const remaining = merged.filter((value) => value === 0).length;

	const persist = useCallback(() => {
		writeSudokuSave({
			...save,
			entries: digitsToString(entries),
			status: statusRef.current,
			elapsedSeconds: elapsedRef.current,
			updatedAt: Date.now(),
		});
	}, [save, entries, elapsedRef]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: status is read through its ref
	useEffect(() => {
		persist();
	}, [persist, status]);
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

	const replace = useCallback(
		(next: number[]) => {
			setUndoStack((stack) => [...stack.slice(-(UNDO_DEPTH - 1)), entries]);
			setEntries(next);
			const nextMerged = givens.map((given, cell) =>
				given !== 0 ? given : next[cell],
			);
			if (isBinarySolved(nextMerged, size)) {
				setStatus("completed");
				haptics.gameWon();
			}
		},
		[entries, givens, size],
	);

	const cycle = useCallback(
		(cell: number) => {
			if (statusRef.current !== "active") return;
			if (givens[cell] !== 0) {
				haptics.moveRejected();
				return;
			}
			const next = [...entries];
			next[cell] = (entries[cell] + 1) % 3;
			replace(next);
			haptics.selectionChanged();
		},
		[entries, givens, replace],
	);

	const undo = useCallback(() => {
		if (statusRef.current !== "active") return;
		const previous = undoStack.at(-1);
		if (!previous) return;
		setUndoStack(undoStack.slice(0, -1));
		setEntries(previous);
		haptics.selectionChanged();
	}, [undoStack]);

	const restart = useCallback(() => {
		if (statusRef.current !== "active") return;
		replace(new Array<number>(size * size).fill(0));
	}, [replace, size]);

	return {
		size,
		givens,
		merged,
		conflicts,
		remaining,
		status,
		elapsed,
		cycle,
		undo,
		canUndo: undoStack.length > 0,
		restart,
		pause,
		resume: () => {
			if (statusRef.current === "paused") setStatus("active");
		},
	};
}
