/**
 * The part of a puzzle in play that every variant shares: its status, the
 * play clock, and writing progress back to the save store. The game hook
 * owns the board and its undo model and passes `write`, which stores the
 * board as it is now; `write` must change whenever the board does, so every
 * board change is saved.
 *
 * A write happens on every board or status change, every
 * `ELAPSED_SAVE_EVERY` seconds of play, and on unmount: leaving the screen
 * unmounts it before the blur-pause can re-render, so the final clock
 * reading is written there.
 */

import type { SudokuStatus } from "@arcadeclub/core/sudoku";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameClock } from "./use-game-clock";

const ELAPSED_SAVE_EVERY = 15;

export type PuzzleProgress = { status: SudokuStatus; elapsedSeconds: number };

export function usePuzzleSession(
	save: PuzzleProgress,
	write: (progress: PuzzleProgress) => void,
) {
	const [status, setStatus] = useState<SudokuStatus>(
		save.status === "completed" ? "completed" : "active",
	);
	const statusRef = useRef(status);
	statusRef.current = status;

	const pause = useCallback(() => {
		if (statusRef.current === "active") setStatus("paused");
	}, []);
	const resume = useCallback(() => {
		if (statusRef.current === "paused") setStatus("active");
	}, []);
	const complete = useCallback(() => setStatus("completed"), []);
	const { elapsed, elapsedRef } = useGameClock({
		initialSeconds: save.elapsedSeconds,
		running: status === "active",
		onAway: pause,
	});

	useEffect(() => {
		write({ status, elapsedSeconds: elapsedRef.current });
	}, [write, status, elapsedRef]);
	const writeLatest = useRef(write);
	writeLatest.current = write;
	useEffect(
		() => () =>
			writeLatest.current({
				status: statusRef.current,
				elapsedSeconds: elapsedRef.current,
			}),
		[elapsedRef],
	);
	useEffect(() => {
		if (
			status === "active" &&
			elapsed > 0 &&
			elapsed % ELAPSED_SAVE_EVERY === 0
		) {
			write({ status, elapsedSeconds: elapsed });
		}
	}, [elapsed, status, write]);

	return { status, statusRef, elapsed, pause, resume, complete };
}
