import type {
	SudokuAction,
	SudokuHistory,
	SudokuInputMode,
} from "@arcadeclub/core/sudoku-board";
import {
	applyAction,
	canRedo,
	canUndo,
	createHistory,
	deserializeBoard,
	effectiveGrid,
	redo,
	undo,
} from "@arcadeclub/core/sudoku-board";
import type { SudokuHint } from "@arcadeclub/core/sudoku-hints";
import { describeHint, findHint } from "@arcadeclub/core/sudoku-hints";
import {
	boardConflictsWithCages,
	isBoardSolved,
} from "@arcadeclub/core/sudoku-killer";
import { useMutation } from "convex/react";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renameLocalSudokuSession } from "#/lib/games/sudoku-local";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CompletedBanner, PauseOverlay, PuzzleHeader } from "./PuzzleChrome";
import { SUDOKU_COLORS, SudokuBoard } from "./SudokuBoard";
import { SudokuKeypad } from "./SudokuKeypad";
import {
	bestEffort,
	type PuzzleStateDoc,
	sudokuProgress,
	useSoloPuzzleSession,
} from "./useSoloPuzzleSession";

type SudokuGameProps = {
	sessionId: Id<"gameSessions">;
	title: string;
	state: PuzzleStateDoc;
};

export function SudokuGame({ sessionId, title, state }: SudokuGameProps) {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const rename = useMutation(api.sudoku.rename);
	const { status, elapsedLabel, isActive, scheduleSave, finish, togglePause } =
		useSoloPuzzleSession(sessionId, state);

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
	const [hint, setHint] = useState<SudokuHint | null>(null);
	const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(title);

	const board = history.current;
	const cages = state.cages;
	const conflicts = useMemo(
		() => boardConflictsWithCages(board, cages),
		[board, cages],
	);
	const digitCounts = useMemo(() => {
		const counts = new Array<number>(10).fill(0);
		for (const value of effectiveGrid(board)) {
			counts[value] += 1;
		}
		return counts;
	}, [board]);

	// The latest history at event time: several inputs can land before React
	// re-renders, and each must build on the one before.
	const historyRef = useRef(history);
	historyRef.current = history;

	const save = useCallback(
		(next: SudokuHistory, nextAutoCleanup: boolean) =>
			scheduleSave(sudokuProgress(next.current, nextAutoCleanup)),
		[scheduleSave],
	);

	/** Moves to `next` and saves it; a solved board completes the session. */
	const commit = useCallback(
		(next: SudokuHistory, checkSolved: boolean) => {
			if (next === historyRef.current) {
				return;
			}
			historyRef.current = next;
			setHistory(next);
			save(next, autoCleanup);
			if (checkSolved && isBoardSolved(next.current, cages)) {
				finish(next.current.digits);
			}
		},
		[save, autoCleanup, cages, finish],
	);

	const dispatch = useCallback(
		(action: SudokuAction) => {
			if (!isActive()) {
				return;
			}
			setHint(null);
			commit(applyAction(historyRef.current, action, { autoCleanup }), true);
		},
		[isActive, commit, autoCleanup],
	);

	const handleUndo = useCallback(() => {
		if (!isActive()) {
			return;
		}
		commit(undo(historyRef.current), false);
	}, [isActive, commit]);

	const handleRedo = useCallback(() => {
		if (!isActive()) {
			return;
		}
		commit(redo(historyRef.current), true);
	}, [isActive, commit]);

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
					color: Math.min(digit, SUDOKU_COLORS.length),
				});
			}
		},
		[selectedCell, mode, dispatch],
	);

	const requestHint = useCallback(() => {
		if (!isActive() || hint) {
			return;
		}
		setHintLevel(1);
		setHint(
			findHint(effectiveGrid(history.current), {
				givens: history.current.givens,
			}),
		);
	}, [isActive, hint, history]);

	// keyboard controls
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}
			if (event.key >= "1" && event.key <= "9") {
				const digit = Number(event.key);
				if (selectedCell !== null && isActive()) {
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
	}, [selectedCell, isActive, dispatch, handleDigit, handleUndo, handleRedo]);

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
		bestEffort(rename({ sessionId, title: next }));
		renameLocalSudokuSession(sessionId, next);
	}, [titleDraft, title, rename, sessionId]);

	return (
		<div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
			{/* Board column: title bar + board. On large/landscape viewports this
			    sits beside the controls column so the keypad stays above the fold. */}
			<div className="flex w-full max-w-[min(94vw,600px)] flex-col items-center gap-4 lg:w-[min(70vh,600px)]">
				<PuzzleHeader
					title={
						editingTitle ? (
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
								title={sudoku.game.renameTooltip}
								className="truncate text-left text-lg font-bold text-white hover:text-sky-300"
							>
								{titleDraft}
							</button>
						)
					}
					details={
						<>
							{state.difficulty
								? sudoku.difficulty[state.difficulty]
								: sudoku.game.importedFallback}
							{state.variant === "killer" ? ` · ${sudoku.variant.killer}` : ""}
							{state.source === "scan" ? ` · ${sudoku.game.scannedLabel}` : ""}
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
					<SudokuBoard
						board={board}
						selectedCell={selectedCell}
						onSelectCell={(cell) =>
							setSelectedCell((current) => (current === cell ? null : cell))
						}
						conflicts={conflicts}
						hintCells={hintCells}
						hidden={status === "paused"}
						cages={cages}
					/>
					{status === "paused" ? <PauseOverlay onResume={togglePause} /> : null}
				</div>
			</div>

			{/* Controls column: hint, keypad, options, keyboard help. */}
			<div className="flex w-full max-w-[min(94vw,600px)] flex-col items-center gap-4 lg:w-[360px] lg:max-w-[360px]">
				{hint ? (
					<div className="w-full rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
						<div className="flex items-center justify-between gap-2">
							<p className="font-bold">
								{hintLevel >= 2
									? describeHint(hint, hintLevel, sudoku.hints).title
									: sudoku.game.hintFallbackTitle}
							</p>
							<button
								type="button"
								onClick={() => setHint(null)}
								className="text-xs text-amber-200/80 hover:text-white"
							>
								{sudoku.game.dismissHint}
							</button>
						</div>
						<p className="mt-1">
							{describeHint(hint, hintLevel, sudoku.hints).text}
						</p>
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
								{sudoku.game.tellMeMore}
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

				<div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
					<label className="inline-flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={autoCleanup}
							onChange={(event) => {
								setAutoCleanup(event.target.checked);
								save(history, event.target.checked);
							}}
							className="accent-sky-400"
						/>
						{sudoku.game.autoCleanupLabel}
					</label>
					<button
						type="button"
						onClick={() => {
							if (window.confirm(sudoku.game.restartConfirm)) {
								dispatch({ type: "restart" });
							}
						}}
						className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 px-2 py-1 font-semibold text-slate-300 hover:bg-slate-800"
					>
						<RotateCcw className="h-3.5 w-3.5" />{" "}
						{messages.common.gameShell.restart}
					</button>
				</div>
				<p className="text-center text-xs text-slate-500">
					{sudoku.game.keyboardHelp}
				</p>
			</div>
		</div>
	);
}
