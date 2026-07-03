import { useMutation } from "convex/react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	SudokuAction,
	SudokuHistory,
	SudokuInputMode,
} from "#/lib/games/sudoku-board";
import {
	applyAction,
	boardConflicts,
	canRedo,
	canUndo,
	createHistory,
	deserializeBoard,
	effectiveGrid,
	isBoardComplete,
	redo,
	undo,
} from "#/lib/games/sudoku-board";
import type { SudokuHint } from "#/lib/games/sudoku-hints";
import { findHint, hintTextForLevel } from "#/lib/games/sudoku-hints";
import { renameLocalSudokuSession } from "#/lib/games/sudoku-local";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SudokuBoard } from "./SudokuBoard";
import { SudokuKeypad } from "./SudokuKeypad";

type SudokuStateDoc = {
	givens: string;
	digits: string;
	cornerNotes: number[];
	centerNotes: number[];
	colors: number[];
	status: "active" | "paused" | "completed";
	difficulty?: "easy" | "medium" | "hard" | "expert";
	source: "generated" | "scan";
	autoCleanup: boolean;
	elapsedSeconds: number;
	lastResumedAt?: number;
};

export type SudokuGameProps = {
	sessionId: Id<"gameSessions">;
	title: string;
	state: SudokuStateDoc;
};

function formatElapsed(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initialElapsed(state: SudokuStateDoc) {
	const running =
		state.status === "active" && state.lastResumedAt
			? Math.max(0, Math.round((Date.now() - state.lastResumedAt) / 1000))
			: 0;
	return state.elapsedSeconds + running;
}

export function SudokuGame({ sessionId, title, state }: SudokuGameProps) {
	const saveProgress = useMutation(api.sudoku.saveProgress);
	const setPaused = useMutation(api.sudoku.setPaused);
	const complete = useMutation(api.sudoku.complete);
	const rename = useMutation(api.sudoku.rename);

	const [history, setHistory] = useState<SudokuHistory>(() =>
		createHistory(
			deserializeBoard({
				givens: state.givens,
				digits: state.digits,
				corner: state.cornerNotes,
				center: state.centerNotes,
				colors: state.colors,
			}),
		),
	);
	const [selectedCell, setSelectedCell] = useState<number | null>(null);
	const [mode, setMode] = useState<SudokuInputMode>("digit");
	const [autoCleanup, setAutoCleanup] = useState(state.autoCleanup);
	const [status, setStatus] = useState(state.status);
	const [elapsed, setElapsed] = useState(() => initialElapsed(state));
	const [hint, setHint] = useState<SudokuHint | null>(null);
	const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(title);

	const board = history.current;
	const conflicts = useMemo(() => boardConflicts(board), [board]);
	const digitCounts = useMemo(() => {
		const counts = new Array<number>(10).fill(0);
		for (const value of effectiveGrid(board)) {
			counts[value] += 1;
		}
		return counts;
	}, [board]);

	const elapsedRef = useRef(elapsed);
	elapsedRef.current = elapsed;
	const statusRef = useRef(status);
	statusRef.current = status;

	// timer tick
	useEffect(() => {
		if (status !== "active") {
			return;
		}
		const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, [status]);

	// debounced persistence
	const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const scheduleSave = useCallback(
		(next: SudokuHistory, nextAutoCleanup: boolean) => {
			clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				if (statusRef.current === "completed") {
					return;
				}
				saveProgress({
					sessionId,
					digits: next.current.digits.join(""),
					cornerNotes: next.current.corner,
					centerNotes: next.current.center,
					colors: next.current.colors,
					elapsedSeconds: elapsedRef.current,
					autoCleanup: nextAutoCleanup,
				}).catch(() => undefined);
			}, 1200);
		},
		[saveProgress, sessionId],
	);
	useEffect(() => () => clearTimeout(saveTimeout.current), []);

	const finishIfComplete = useCallback(
		(next: SudokuHistory) => {
			if (!isBoardComplete(next.current)) {
				return;
			}
			clearTimeout(saveTimeout.current);
			setStatus("completed");
			complete({
				sessionId,
				digits: next.current.digits.join(""),
				elapsedSeconds: elapsedRef.current,
			}).catch(() => undefined);
		},
		[complete, sessionId],
	);

	const dispatch = useCallback(
		(action: SudokuAction) => {
			if (statusRef.current !== "active") {
				return;
			}
			setHint(null);
			setHistory((current) => {
				const next = applyAction(current, action, { autoCleanup });
				if (next !== current) {
					scheduleSave(next, autoCleanup);
					finishIfComplete(next);
				}
				return next;
			});
		},
		[autoCleanup, scheduleSave, finishIfComplete],
	);

	const handleUndo = useCallback(() => {
		if (statusRef.current !== "active") {
			return;
		}
		setHistory((current) => {
			const next = undo(current);
			if (next !== current) {
				scheduleSave(next, autoCleanup);
			}
			return next;
		});
	}, [scheduleSave, autoCleanup]);

	const handleRedo = useCallback(() => {
		if (statusRef.current !== "active") {
			return;
		}
		setHistory((current) => {
			const next = redo(current);
			if (next !== current) {
				scheduleSave(next, autoCleanup);
				finishIfComplete(next);
			}
			return next;
		});
	}, [scheduleSave, autoCleanup, finishIfComplete]);

	const handleDigit = useCallback(
		(digit: number) => {
			if (selectedCell === null) {
				return;
			}
			if (mode === "digit") {
				dispatch({ type: "setDigit", cell: selectedCell, digit });
			} else if (mode === "corner") {
				dispatch({ type: "toggleCorner", cell: selectedCell, digit });
			} else if (mode === "center") {
				dispatch({ type: "toggleCenter", cell: selectedCell, digit });
			} else {
				dispatch({
					type: "setColor",
					cell: selectedCell,
					color: Math.min(digit, 8),
				});
			}
		},
		[selectedCell, mode, dispatch],
	);

	const togglePause = useCallback(() => {
		if (statusRef.current === "completed") {
			return;
		}
		const pausing = statusRef.current === "active";
		setStatus(pausing ? "paused" : "active");
		setPaused({ sessionId, paused: pausing }).catch(() => undefined);
	}, [setPaused, sessionId]);

	const requestHint = useCallback(() => {
		if (statusRef.current !== "active") {
			return;
		}
		setHint((current) => {
			if (current) {
				return current;
			}
			setHintLevel(1);
			return findHint(effectiveGrid(history.current));
		});
	}, [history]);

	// keyboard controls
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}
			if (event.key >= "1" && event.key <= "9") {
				const digit = Number(event.key);
				if (selectedCell !== null && statusRef.current === "active") {
					if (event.shiftKey) {
						dispatch({ type: "toggleCorner", cell: selectedCell, digit });
					} else if (event.ctrlKey || event.altKey) {
						event.preventDefault();
						dispatch({ type: "toggleCenter", cell: selectedCell, digit });
					} else {
						handleDigit(digit);
					}
				}
				return;
			}
			switch (event.key) {
				case "Backspace":
				case "Delete":
					if (selectedCell !== null) {
						dispatch({ type: "erase", cell: selectedCell });
					}
					break;
				case "ArrowUp":
				case "ArrowDown":
				case "ArrowLeft":
				case "ArrowRight": {
					event.preventDefault();
					setSelectedCell((current) => {
						const base = current ?? 0;
						if (current === null) {
							return 0;
						}
						if (event.key === "ArrowUp") {
							return base >= 9 ? base - 9 : base;
						}
						if (event.key === "ArrowDown") {
							return base < 72 ? base + 9 : base;
						}
						if (event.key === "ArrowLeft") {
							return base % 9 > 0 ? base - 1 : base;
						}
						return base % 9 < 8 ? base + 1 : base;
					});
					break;
				}
				case "z":
					if (event.ctrlKey || event.metaKey) {
						event.preventDefault();
						handleUndo();
					}
					break;
				case "y":
					if (event.ctrlKey || event.metaKey) {
						event.preventDefault();
						handleRedo();
					}
					break;
				case " ":
					event.preventDefault();
					setMode((current) =>
						current === "digit"
							? "corner"
							: current === "corner"
								? "center"
								: current === "center"
									? "color"
									: "digit",
					);
					break;
				default:
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selectedCell, dispatch, handleDigit, handleUndo, handleRedo]);

	const hintCells = useMemo(() => {
		if (!hint) {
			return undefined;
		}
		if (hintLevel === 1) {
			return undefined; // subtle nudge: text only
		}
		const cells = new Set(hint.cells);
		if (hintLevel === 3) {
			for (const entry of hint.eliminations) {
				cells.add(entry.cell);
			}
			for (const entry of hint.placements) {
				cells.add(entry.cell);
			}
		}
		return cells;
	}, [hint, hintLevel]);

	const saveTitle = useCallback(() => {
		setEditingTitle(false);
		const next = titleDraft.trim();
		if (!next || next === title) {
			setTitleDraft(title);
			return;
		}
		rename({ sessionId, title: next }).catch(() => undefined);
		renameLocalSudokuSession(sessionId, next);
	}, [titleDraft, title, rename, sessionId]);

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="flex w-full max-w-[min(94vw,600px)] flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					{editingTitle ? (
						<input
							ref={(element) => element?.focus()}
							value={titleDraft}
							onChange={(event) => setTitleDraft(event.target.value)}
							onBlur={saveTitle}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									saveTitle();
								}
								if (event.key === "Escape") {
									setTitleDraft(title);
									setEditingTitle(false);
								}
							}}
							className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
							maxLength={80}
						/>
					) : (
						<button
							type="button"
							onClick={() => setEditingTitle(true)}
							title="Rename this puzzle"
							className="truncate text-left text-lg font-bold text-white hover:text-sky-300"
						>
							{titleDraft}
						</button>
					)}
					<p className="text-xs text-slate-400">
						{state.difficulty
							? `${state.difficulty[0].toUpperCase()}${state.difficulty.slice(1)}`
							: "Imported"}
						{state.source === "scan" ? " · scanned" : ""}
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
									<Pause className="h-4 w-4" /> Pause
								</>
							) : (
								<>
									<Play className="h-4 w-4" /> Resume
								</>
							)}
						</button>
					) : null}
				</div>
			</div>

			{status === "completed" ? (
				<div className="w-full max-w-[min(94vw,600px)] rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-3 text-emerald-200">
					<p className="font-bold">Solved! 🎉</p>
					<p className="text-sm">
						Completed in {formatElapsed(elapsed)}.{" "}
						<a href="/sudoku/new" className="underline hover:text-white">
							Start another puzzle
						</a>
					</p>
				</div>
			) : null}

			<div className="relative w-full max-w-[min(94vw,600px)]">
				<SudokuBoard
					board={board}
					selectedCell={selectedCell}
					onSelectCell={(cell) =>
						setSelectedCell((current) => (current === cell ? null : cell))
					}
					conflicts={conflicts}
					hintCells={hintCells}
					hidden={status === "paused"}
				/>
				{status === "paused" ? (
					<button
						type="button"
						onClick={togglePause}
						className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/80 text-slate-200"
					>
						<Play className="h-10 w-10" />
						<span className="font-bold">Paused — tap to resume</span>
					</button>
				) : null}
			</div>

			{hint ? (
				<div className="w-full max-w-[min(94vw,600px)] rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
					<div className="flex items-center justify-between gap-2">
						<p className="font-bold">{hintLevel >= 2 ? hint.title : "Hint"}</p>
						<button
							type="button"
							onClick={() => setHint(null)}
							className="text-xs text-amber-200/80 hover:text-white"
						>
							Dismiss
						</button>
					</div>
					<p className="mt-1">{hintTextForLevel(hint, hintLevel)}</p>
					{hintLevel < 3 ? (
						<button
							type="button"
							onClick={() =>
								setHintLevel((level) =>
									level < 3 ? ((level + 1) as 2 | 3) : level,
								)
							}
							className="mt-2 rounded-md border border-amber-300/50 px-2 py-1 text-xs font-semibold hover:bg-amber-400/20"
						>
							Tell me more
						</button>
					) : null}
				</div>
			) : null}

			<SudokuKeypad
				mode={mode}
				onModeChange={setMode}
				onDigit={handleDigit}
				onColor={(color) =>
					selectedCell !== null &&
					dispatch({ type: "setColor", cell: selectedCell, color })
				}
				onErase={() =>
					selectedCell !== null &&
					dispatch({ type: "erase", cell: selectedCell })
				}
				onUndo={handleUndo}
				onRedo={handleRedo}
				onHint={requestHint}
				canUndo={canUndo(history)}
				canRedo={canRedo(history)}
				digitCounts={digitCounts}
				disabled={status !== "active"}
			/>

			<div className="flex w-full max-w-[min(94vw,600px)] flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
				<label className="inline-flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						checked={autoCleanup}
						onChange={(event) => {
							setAutoCleanup(event.target.checked);
							scheduleSave(history, event.target.checked);
						}}
						className="accent-sky-400"
					/>
					Auto-remove notes when a digit is placed
				</label>
				<button
					type="button"
					onClick={() => {
						if (
							window.confirm(
								"Restart this puzzle? Your progress is kept in undo history.",
							)
						) {
							dispatch({ type: "restart" });
						}
					}}
					className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 px-2 py-1 font-semibold text-slate-300 hover:bg-slate-800"
				>
					<RotateCcw className="h-3.5 w-3.5" /> Restart
				</button>
			</div>
			<p className="max-w-[min(94vw,600px)] text-center text-xs text-slate-500">
				Keyboard: 1-9 digits · Shift+digit corner note · Ctrl+digit center note
				· Space cycles mode · Ctrl+Z/Y undo/redo · arrows move
			</p>
		</div>
	);
}
