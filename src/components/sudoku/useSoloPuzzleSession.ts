import { gameErrorData } from "@arcadeclub/core/errors";
import { digitsToString } from "@arcadeclub/core/puzzle";
import type { SudokuBoardState } from "@arcadeclub/core/sudoku-board";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { reportHostOnlyRejection } from "#/lib/observability/convex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** The stored puzzle, minus the solution the server never sends. */
export type PuzzleStateDoc = NonNullable<
	FunctionReturnType<typeof api.sudoku.getBundle>
>["state"];

/** What a debounced save writes, besides the session and the clock. */
export type PuzzleProgress = Omit<
	FunctionArgs<typeof api.sudoku.saveProgress>,
	"sessionId" | "guestId" | "elapsedSeconds" | "baseUpdatedAt"
>;

const SAVE_DEBOUNCE_MS = 1200;

/**
 * A solo puzzle saves, pauses and completes on a best-effort basis: a failed
 * write is dropped and the board keeps going. This is the one place that
 * decides so. The one failure worth a signal is `hostOnly`: the caller no
 * longer owns the puzzle (a guest id the browser could not keep), so every
 * later save is refused too. It is reported once, not dropped.
 */
export function bestEffort(write: Promise<unknown>, operation: string) {
	write.catch((error: unknown) => {
		if (gameErrorData(error)?.code === "hostOnly") {
			reportHostOnlyRejection(operation);
		}
	});
}

/**
 * The session and this browser's guest id, which proves a guest's puzzle is
 * theirs on every write. A signed-in host's account proves it instead.
 */
export function puzzleWrite(sessionId: Id<"gameSessions">) {
	return { sessionId, guestId: getOrCreateGuestIdentity().id };
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
 *
 * Each save names the version its board builds on. When another device has
 * saved a newer board, the server refuses the save and `onStale` runs: the
 * owner reloads the board from the stored puzzle (`SoloPuzzle`).
 */
export function useSoloPuzzleSession(
	sessionId: Id<"gameSessions">,
	state: PuzzleStateDoc,
	onStale: () => void,
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
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			clearTimeout(saveTimeout.current);
		};
	}, []);

	// The version the board here builds on: the one it was loaded from, then
	// the one each save answers with. Saves go one at a time, because a save
	// sent before the last one's answer would name an outdated version.
	const baseUpdatedAt = useRef(state.updatedAt);
	const saving = useRef(false);
	const queued = useRef<PuzzleProgress | null>(null);

	const send = useCallback(
		(progress: PuzzleProgress) => {
			if (statusRef.current === "completed") {
				return;
			}
			if (saving.current) {
				queued.current = progress;
				return;
			}
			saving.current = true;
			const write = async () => {
				try {
					const { saved, updatedAt } = await saveProgress({
						...puzzleWrite(sessionId),
						...progress,
						baseUpdatedAt: baseUpdatedAt.current,
						elapsedSeconds: elapsedRef.current,
					});
					if (saved) {
						baseUpdatedAt.current = updatedAt;
						return;
					}
					queued.current = null;
					clearTimeout(saveTimeout.current);
					// A board solved meanwhile stands: `complete` decides.
					if (mounted.current && statusRef.current !== "completed") {
						onStale();
					}
				} finally {
					saving.current = false;
					const next = queued.current;
					queued.current = null;
					if (next) {
						send(next);
					}
				}
			};
			bestEffort(write(), "sudoku:saveProgress");
		},
		[saveProgress, sessionId, onStale],
	);

	/** Saves `progress` once input has been quiet for a moment. */
	const scheduleSave = useCallback(
		(progress: PuzzleProgress) => {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => send(progress), SAVE_DEBOUNCE_MS);
		},
		[send],
	);

	/** Stops the clock and records the solved grid instead of a pending save. */
	const finish = useCallback(
		(digits: number[]) => {
			clearTimeout(saveTimeout.current);
			queued.current = null;
			statusRef.current = "completed";
			setStatus("completed");
			bestEffort(
				complete({
					...puzzleWrite(sessionId),
					digits: digitsToString(digits),
					elapsedSeconds: elapsedRef.current,
				}),
				"sudoku:complete",
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
		bestEffort(
			setPaused({ ...puzzleWrite(sessionId), paused: pausing }),
			"sudoku:setPaused",
		);
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
