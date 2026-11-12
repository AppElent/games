import {
	binaryDigitLabel,
	findBinaryConflicts,
	isBinarySolved,
	nextBinaryCell,
} from "@arcadeclub/core/binary-puzzle";
import { RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { fmt, plural, useI18n } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";
import { CompletedBanner, PauseOverlay, PuzzleHeader } from "./PuzzleChrome";
import {
	binaryProgress,
	type PuzzleStateDoc,
	useSoloPuzzleSession,
} from "./useSoloPuzzleSession";

type BinaryGameProps = {
	sessionId: Id<"gameSessions">;
	title: string;
	state: PuzzleStateDoc;
};

export function BinaryGame({ sessionId, title, state }: BinaryGameProps) {
	const { locale, messages } = useI18n();
	const sudoku = messages.games.sudoku;
	const {
		status,
		elapsedLabel,
		isActive,
		scheduleSave: scheduleProgress,
		finish,
		togglePause,
	} = useSoloPuzzleSession(sessionId, state);

	const size = state.size ?? 6;
	const cellCount = size * size;
	const givens = useMemo(() => [...state.givens].map(Number), [state.givens]);
	const [entries, setEntries] = useState<number[]>(() =>
		[...state.digits].map(Number),
	);
	const [undoStack, setUndoStack] = useState<number[][]>([]);

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

	const scheduleSave = useCallback(
		(nextEntries: number[]) =>
			scheduleProgress(binaryProgress(nextEntries, cellCount)),
		[scheduleProgress, cellCount],
	);

	const cycleCell = useCallback(
		(cell: number) => {
			if (!isActive() || givens[cell] !== 0) {
				return;
			}
			const value = nextBinaryCell(entries[cell] ?? 0);
			const next = [...entries];
			next[cell] = value;
			setUndoStack((stack) => [...stack.slice(-99), entries]);
			setEntries(next);
			scheduleSave(next);
			const nextMerged = givens.map((given, i) =>
				given !== 0 ? given : next[i],
			);
			if (isBinarySolved(nextMerged, size)) {
				finish(next);
			}
		},
		[isActive, entries, givens, scheduleSave, size, finish],
	);

	const handleUndo = useCallback(() => {
		if (!isActive() || undoStack.length === 0) {
			return;
		}
		const previous = undoStack[undoStack.length - 1];
		setUndoStack(undoStack.slice(0, -1));
		setEntries(previous);
		scheduleSave(previous);
	}, [isActive, undoStack, scheduleSave]);

	const restart = useCallback(() => {
		if (!isActive()) {
			return;
		}
		if (!window.confirm(sudoku.binary.restartConfirm)) {
			return;
		}
		const cleared = new Array<number>(cellCount).fill(0);
		setUndoStack((stack) => [...stack.slice(-99), entries]);
		setEntries(cleared);
		scheduleSave(cleared);
	}, [isActive, cellCount, entries, scheduleSave, sudoku]);

	return (
		<div className="flex flex-col items-center gap-4">
			{/* Binary rows are narrower than the Sudoku column they sit in. */}
			<div className="flex w-full max-w-[min(94vw,560px)] flex-col gap-4">
				<PuzzleHeader
					title={
						<p className="truncate text-lg font-bold text-white">{title}</p>
					}
					details={
						<>
							{state.difficulty
								? sudoku.difficulty[state.difficulty]
								: sudoku.variant.binary}
							{` · ${fmt(sudoku.binary.dimensions, { size })}`}
						</>
					}
					status={status}
					elapsedLabel={elapsedLabel}
					onTogglePause={togglePause}
				/>

				{status === "completed" ? (
					<CompletedBanner elapsedLabel={elapsedLabel} />
				) : null}

				<div className="relative w-full">
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
					{status === "paused" ? <PauseOverlay onResume={togglePause} /> : null}
				</div>

				<div className="flex w-full flex-wrap items-center justify-between gap-2">
					<p className="text-xs text-slate-400">{sudoku.binary.instructions}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleUndo}
							disabled={undoStack.length === 0 || status !== "active"}
							className="inline-flex items-center gap-1 rounded-md border border-[var(--club-line-strong)] px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Undo2 className="h-4 w-4" /> {sudoku.keypad.undo}
						</button>
						<button
							type="button"
							onClick={restart}
							disabled={status !== "active"}
							className="inline-flex items-center gap-1 rounded-md border border-[var(--club-line-strong)] px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<RotateCcw className="h-4 w-4" />{" "}
							{messages.common.gameShell.restart}
						</button>
					</div>
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
