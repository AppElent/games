import { useMutation } from "convex/react";
import { Pause, Play, RotateCcw, Timer, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	binaryDigitLabel,
	findBinaryConflicts,
	isBinarySolved,
} from "#/lib/games/binary-puzzle";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type BinaryStateDoc = {
	givens: string;
	digits: string;
	size?: number;
	status: "active" | "paused" | "completed";
	difficulty?: "easy" | "medium" | "hard" | "expert";
	elapsedSeconds: number;
	lastResumedAt?: number;
};

export type BinaryGameProps = {
	sessionId: Id<"gameSessions">;
	title: string;
	state: BinaryStateDoc;
};

function formatElapsed(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initialElapsed(state: BinaryStateDoc) {
	const running =
		state.status === "active" && state.lastResumedAt
			? Math.max(0, Math.round((Date.now() - state.lastResumedAt) / 1000))
			: 0;
	return state.elapsedSeconds + running;
}

export function BinaryGame({ sessionId, title, state }: BinaryGameProps) {
	const { locale, messages } = useI18n();
	const sudoku = messages.games.sudoku;
	const saveProgress = useMutation(api.sudoku.saveProgress);
	const setPaused = useMutation(api.sudoku.setPaused);
	const complete = useMutation(api.sudoku.complete);

	const size = state.size ?? 6;
	const cellCount = size * size;
	const givens = useMemo(() => [...state.givens].map(Number), [state.givens]);
	const [entries, setEntries] = useState<number[]>(() =>
		[...state.digits].map(Number),
	);
	const [undoStack, setUndoStack] = useState<number[][]>([]);
	const [status, setStatus] = useState(state.status);
	const [elapsed, setElapsed] = useState(() => initialElapsed(state));

	const merged = useMemo(
		() =>
			givens.map((value, cell) => (value !== 0 ? value : (entries[cell] ?? 0))),
		[givens, entries],
	);
	const conflicts = useMemo(
		() => findBinaryConflicts(merged, size),
		[merged, size],
	);
	const remaining = merged.filter((value) => value === 0).length;

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
	const scheduleSave = useCallback(
		(nextEntries: number[]) => {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				if (statusRef.current === "completed") {
					return;
				}
				saveProgress({
					sessionId,
					digits: nextEntries.join(""),
					cornerNotes: new Array(cellCount).fill(0),
					centerNotes: new Array(cellCount).fill(0),
					colors: new Array(cellCount).fill(0),
					elapsedSeconds: elapsedRef.current,
				}).catch(() => undefined);
			}, 1200);
		},
		[saveProgress, sessionId, cellCount],
	);
	useEffect(() => () => clearTimeout(saveTimeout.current), []);

	const cycleCell = useCallback(
		(cell: number) => {
			if (statusRef.current !== "active" || givens[cell] !== 0) {
				return;
			}
			const value = ((entries[cell] ?? 0) + 1) % 3;
			const next = [...entries];
			next[cell] = value;
			setUndoStack((stack) => [...stack.slice(-99), entries]);
			setEntries(next);
			scheduleSave(next);
			const nextMerged = givens.map((given, i) =>
				given !== 0 ? given : next[i],
			);
			if (isBinarySolved(nextMerged, size)) {
				clearTimeout(saveTimeout.current);
				setStatus("completed");
				complete({
					sessionId,
					digits: next.join(""),
					elapsedSeconds: elapsedRef.current,
				}).catch(() => undefined);
			}
		},
		[entries, givens, scheduleSave, size, complete, sessionId],
	);

	const handleUndo = useCallback(() => {
		if (statusRef.current !== "active" || undoStack.length === 0) {
			return;
		}
		const previous = undoStack[undoStack.length - 1];
		setUndoStack(undoStack.slice(0, -1));
		setEntries(previous);
		scheduleSave(previous);
	}, [undoStack, scheduleSave]);

	const togglePause = useCallback(() => {
		if (statusRef.current === "completed") {
			return;
		}
		const pausing = statusRef.current === "active";
		setStatus(pausing ? "paused" : "active");
		setPaused({ sessionId, paused: pausing }).catch(() => undefined);
	}, [setPaused, sessionId]);

	const restart = useCallback(() => {
		if (statusRef.current !== "active") {
			return;
		}
		if (!window.confirm(sudoku.binary.restartConfirm)) {
			return;
		}
		const cleared = new Array<number>(cellCount).fill(0);
		setUndoStack((stack) => [...stack.slice(-99), entries]);
		setEntries(cleared);
		scheduleSave(cleared);
	}, [cellCount, entries, scheduleSave, sudoku]);

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="flex w-full max-w-[min(94vw,560px)] flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-lg font-bold text-white">{title}</p>
					<p className="text-xs text-slate-400">
						{state.difficulty
							? sudoku.difficulty[state.difficulty]
							: sudoku.variant.binary}
						{` · ${fmt(sudoku.binary.dimensions, { size })}`}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/70 px-2 py-1 font-mono text-sm text-slate-200">
						<Timer className="h-4 w-4" /> {formatElapsed(elapsed)}
					</span>
					{status !== "completed" ? (
						<button
							type="button"
							onClick={togglePause}
							className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/70 px-2 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-700"
						>
							{status === "active" ? (
								<>
									<Pause className="h-4 w-4" /> {sudoku.game.pauseButton}
								</>
							) : (
								<>
									<Play className="h-4 w-4" />{" "}
									{messages.common.gameShell.resume}
								</>
							)}
						</button>
					) : null}
				</div>
			</div>

			{status === "completed" ? (
				<div className="w-full max-w-[min(94vw,560px)] rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-3 text-emerald-200">
					<p className="font-bold">{sudoku.game.solvedTitle}</p>
					<p className="text-sm">
						{fmt(sudoku.game.completedIn, { time: formatElapsed(elapsed) })}{" "}
						<a href="/sudoku/new" className="underline hover:text-white">
							{sudoku.game.startAnotherPuzzle}
						</a>
					</p>
				</div>
			) : null}

			<div className="relative w-full max-w-[min(94vw,560px)]">
				<div
					className="grid aspect-square w-full select-none rounded-lg border-2 border-slate-400 bg-white shadow-lg dark:border-slate-300/80 dark:bg-slate-900"
					style={{
						gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
						gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
					}}
				>
					{merged.map((value, cell) => {
						const row = Math.floor(cell / size);
						const col = cell % size;
						const isGiven = givens[cell] !== 0;
						const isConflict = conflicts.has(cell);
						return (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
								key={cell}
								type="button"
								aria-label={`${fmt(sudoku.board.cellLabel, { row: row + 1, col: col + 1 })}${value !== 0 ? `, ${binaryDigitLabel(value)}` : ""}`}
								disabled={isGiven || status !== "active"}
								onClick={() => cycleCell(cell)}
								className={`flex items-center justify-center border-slate-300 p-0 dark:border-slate-600/60 ${
									col > 0 ? "border-l" : ""
								} ${row > 0 ? "border-t" : ""} ${
									isGiven
										? "bg-slate-100 dark:bg-slate-800/70"
										: "hover:bg-sky-100 dark:hover:bg-slate-700/50"
								} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300`}
							>
								{status === "paused" ? null : (
									<span
										className={`text-[clamp(1rem,4.5vw,1.8rem)] font-bold leading-none ${
											isConflict
												? "text-red-500 dark:text-red-400"
												: isGiven
													? "text-slate-900 dark:text-slate-100"
													: "text-sky-600 dark:text-sky-300"
										}`}
									>
										{binaryDigitLabel(value)}
									</span>
								)}
							</button>
						);
					})}
				</div>
				{status === "paused" ? (
					<button
						type="button"
						onClick={togglePause}
						className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/80 text-slate-200"
					>
						<Play className="h-10 w-10" />
						<span className="font-bold">{sudoku.game.pausedOverlay}</span>
					</button>
				) : null}
			</div>

			<div className="flex w-full max-w-[min(94vw,560px)] flex-wrap items-center justify-between gap-2">
				<p className="text-xs text-slate-400">{sudoku.binary.instructions}</p>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleUndo}
						disabled={undoStack.length === 0 || status !== "active"}
						className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Undo2 className="h-4 w-4" /> {sudoku.keypad.undo}
					</button>
					<button
						type="button"
						onClick={restart}
						disabled={status !== "active"}
						className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<RotateCcw className="h-4 w-4" />{" "}
						{messages.common.gameShell.restart}
					</button>
				</div>
			</div>
			{remaining > 0 && status === "active" ? (
				<p className="text-xs text-slate-500">
					{plural(locale, remaining, sudoku.binary.remainingCells)}
				</p>
			) : null}
		</div>
	);
}
