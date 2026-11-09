import { digitsToString } from "@arcadeclub/core/puzzle";
import type { SudokuBoardState } from "@arcadeclub/core/sudoku-board";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** The stored puzzle, minus the solution the server never sends. */
export type PuzzleStateDoc = NonNullable<
	FunctionReturnType<typeof api.sudoku.getBundle>
>["state"];

/** What a debounced save writes, besides the session and the clock. */
export type PuzzleProgress = Omit<
	FunctionArgs<typeof api.sudoku.saveProgress>,
	"sessionId" | "elapsedSeconds"
>;

const SAVE_DEBOUNCE_MS = 1200;

/**
 * A solo puzzle saves, pauses and completes on a best-effort basis: a failed
 * write is dropped and the board keeps going. This is the one place that
 * decides so.
 */
export function bestEffort(write: Promise<unknown>) {
	write.catch(() => undefined);
}

/** A Sudoku board as `sudoku.saveProgress` stores it. */
export function sudokuProgress(
	board: SudokuBoardState,
	autoCleanup: boolean,
): PuzzleProgress {
	return {
		digits: digitsToString(board.digits),
		cornerNotes: board.corner,
		centerNotes: board.center,
		colors: board.colors,
		autoCleanup,
	};
}

/**
 * A binary grid through the same mutation: it has no notes or colours, so
 * those masks are sent empty.
 */
export function binaryProgress(
	entries: number[],
	cellCount: number,
): PuzzleProgress {
	return {
		digits: digitsToString(entries),
		cornerNotes: new Array(cellCount).fill(0),
		centerNotes: new Array(cellCount).fill(0),
		colors: new Array(cellCount).fill(0),
	};
}

function formatElapsed(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initialElapsed(state: PuzzleStateDoc) {
	const running =
		state.status === "active" && state.lastResumedAt
			? Math.max(0, Math.round((Date.now() - state.lastResumedAt) / 1000))
			: 0;
	return state.elapsedSeconds + running;
}

/**
 * The session around a solo puzzle board: status, the running clock, a
 * debounced progress save, pause and completion. Sudoku and Binary share it;
 * each keeps its own board and input model.
 */
export function useSoloPuzzleSession(
	sessionId: Id<"gameSessions">,
	state: PuzzleStateDoc,
) {
	const saveProgress = useMutation(api.sudoku.saveProgress);
	const setPaused = useMutation(api.sudoku.setPaused);
	const complete = useMutation(api.sudoku.complete);
	const [status, setStatus] = useState(state.status);
	const [elapsed, setElapsed] = useState(() => initialElapsed(state));

	const elapsedRef = useRef(elapsed);
	elapsedRef.current = elapsed;
	const statusRef = useRef(status);
	statusRef.current = status;

	useEffect(() => {
		if (status !== "active") {
			return;
		}
		const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, [status]);

	const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	useEffect(() => () => clearTimeout(saveTimeout.current), []);

	/** Saves `progress` once input has been quiet for a moment. */
	const scheduleSave = useCallback(
		(progress: PuzzleProgress) => {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				if (statusRef.current === "completed") {
					return;
				}
				bestEffort(
					saveProgress({
						sessionId,
						...progress,
						elapsedSeconds: elapsedRef.current,
					}),
				);
			}, SAVE_DEBOUNCE_MS);
		},
		[saveProgress, sessionId],
	);

	/** Stops the clock and records the solved grid instead of a pending save. */
	const finish = useCallback(
		(digits: number[]) => {
			clearTimeout(saveTimeout.current);
			setStatus("completed");
			bestEffort(
				complete({
					sessionId,
					digits: digitsToString(digits),
					elapsedSeconds: elapsedRef.current,
				}),
			);
		},
		[complete, sessionId],
	);

	const togglePause = useCallback(() => {
		if (statusRef.current === "completed") {
			return;
		}
		const pausing = statusRef.current === "active";
		setStatus(pausing ? "paused" : "active");
		bestEffort(setPaused({ sessionId, paused: pausing }));
	}, [setPaused, sessionId]);

	/** Read at event time, so a handler never acts on a stale status. */
	const isActive = useCallback(() => statusRef.current === "active", []);

	return {
		status,
		elapsed,
		elapsedLabel: formatElapsed(elapsed),
		isActive,
		scheduleSave,
		finish,
		togglePause,
	};
}
