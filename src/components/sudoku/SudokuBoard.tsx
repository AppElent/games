import { colOf, digitsInMask, rowOf } from "@arcadeclub/core/sudoku";
import type { SudokuBoardState } from "@arcadeclub/core/sudoku-board";
import { effectiveGrid } from "@arcadeclub/core/sudoku-board";
import {
	type KillerCage,
	killerCageLayout,
} from "@arcadeclub/core/sudoku-killer";
import { useMemo } from "react";
import { fmt, useMessages } from "#/lib/i18n";

/**
 * Cell colours 1-8, in the order boards store them: entry `i` is colour
 * `i + 1` (0 = none). `tint` fills a board cell, `swatch` draws its keypad
 * button. Saved boards keep these numbers, so append, never reorder.
 */
export const SUDOKU_COLORS = [
	{ tint: "bg-sky-500/40", swatch: "bg-sky-500" },
	{ tint: "bg-emerald-500/40", swatch: "bg-emerald-500" },
	{ tint: "bg-amber-500/40", swatch: "bg-amber-500" },
	{ tint: "bg-rose-500/40", swatch: "bg-rose-500" },
	{ tint: "bg-violet-500/40", swatch: "bg-violet-500" },
	{ tint: "bg-teal-500/40", swatch: "bg-teal-500" },
	{ tint: "bg-orange-500/40", swatch: "bg-orange-500" },
	{ tint: "bg-pink-500/40", swatch: "bg-pink-500" },
] as const;

const CORNER_SLOTS = [
	"left-0.5 top-0",
	"right-0.5 top-0",
	"left-0.5 bottom-0",
	"right-0.5 bottom-0",
	"left-1/2 top-0 -translate-x-1/2",
	"left-1/2 bottom-0 -translate-x-1/2",
	"left-0.5 top-1/2 -translate-y-1/2",
	"right-0.5 top-1/2 -translate-y-1/2",
];

type SudokuBoardProps = {
	board: SudokuBoardState;
	selectedCell: number | null;
	onSelectCell?: (cell: number) => void;
	conflicts?: ReadonlySet<number>;
	hintCells?: ReadonlySet<number>;
	hidden?: boolean;
	className?: string;
	/** Killer sudoku cages: dashed outlines plus a sum in each cage's corner. */
	cages?: KillerCage[];
};

export function SudokuBoard({
	board,
	selectedCell,
	onSelectCell,
	conflicts,
	hintCells,
	hidden = false,
	className = "",
	cages,
}: SudokuBoardProps) {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const grid = effectiveGrid(board);
	const cageInfo = useMemo(() => killerCageLayout(cages), [cages]);
	const selectedDigit =
		selectedCell !== null && grid[selectedCell] !== 0 ? grid[selectedCell] : 0;
	const selRow = selectedCell !== null ? rowOf(selectedCell) : -1;
	const selCol = selectedCell !== null ? colOf(selectedCell) : -1;
	const selBoxRow = selRow >= 0 ? Math.floor(selRow / 3) : -1;
	const selBoxCol = selCol >= 0 ? Math.floor(selCol / 3) : -1;

	return (
		<div
			className={`puzzle-board grid aspect-square w-full select-none grid-cols-9 grid-rows-9 rounded-lg border-2 border-slate-600 bg-white shadow-lg dark:border-slate-300/80 dark:bg-slate-900 ${className}`}
		>
			{grid.map((value, cell) => {
				const row = rowOf(cell);
				const col = colOf(cell);
				const isGiven = board.givens[cell] !== 0;
				const isSelected = cell === selectedCell;
				const isPeer =
					!isSelected &&
					selectedCell !== null &&
					(row === selRow ||
						col === selCol ||
						(Math.floor(row / 3) === selBoxRow &&
							Math.floor(col / 3) === selBoxCol));
				const sameDigit =
					selectedDigit !== 0 && value === selectedDigit && !isSelected;
				const isConflict = conflicts?.has(cell) ?? false;
				const isHint = hintCells?.has(cell) ?? false;
				const colorClass = SUDOKU_COLORS[board.colors[cell] - 1]?.tint ?? "";

				const borders = [
					col % 3 === 0
						? "border-l-2 border-l-slate-600 dark:border-l-slate-300/70"
						: "border-l border-l-[var(--puzzle-line)]",
					row % 3 === 0
						? "border-t-2 border-t-slate-600 dark:border-t-slate-300/70"
						: "border-t border-t-[var(--puzzle-line)]",
					col === 8
						? "border-r-2 border-r-slate-600 dark:border-r-slate-300/70"
						: "",
					row === 8
						? "border-b-2 border-b-slate-600 dark:border-b-slate-300/70"
						: "",
				].join(" ");

				const background = isSelected
					? "bg-sky-300/60 dark:bg-sky-400/30"
					: isHint
						? "bg-amber-300/50 dark:bg-amber-300/25"
						: sameDigit
							? "bg-sky-400/25 dark:bg-sky-500/20"
							: isPeer
								? "bg-slate-200 dark:bg-slate-700/40"
								: "";

				const cageEdges = cageInfo ? cageInfo.edges[cell] : null;
				const cageSum = cageInfo?.sumAt.get(cell);

				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed 81-cell grid
						key={cell}
						type="button"
						aria-label={fmt(sudoku.board.cellLabel, {
							row: row + 1,
							col: col + 1,
						})}
						onClick={() => onSelectCell?.(cell)}
						className={`relative flex items-center justify-center overflow-hidden p-0 ${borders} ${colorClass} ${background} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300`}
					>
						{cageEdges && !hidden ? (
							<span
								aria-hidden="true"
								className="pointer-events-none absolute border-dashed border-slate-600 dark:border-slate-300/70"
								style={{
									top: cageEdges.top ? 2 : 0,
									bottom: cageEdges.bottom ? 2 : 0,
									left: cageEdges.left ? 2 : 0,
									right: cageEdges.right ? 2 : 0,
									borderTopWidth: cageEdges.top ? 1 : 0,
									borderBottomWidth: cageEdges.bottom ? 1 : 0,
									borderLeftWidth: cageEdges.left ? 1 : 0,
									borderRightWidth: cageEdges.right ? 1 : 0,
								}}
							/>
						) : null}
						{cageSum !== undefined && !hidden ? (
							<span
								aria-hidden="true"
								className="pointer-events-none absolute left-1 top-0.5 text-[clamp(0.42rem,1.5vw,0.62rem)] font-bold leading-none text-slate-500 dark:text-slate-400"
							>
								{cageSum}
							</span>
						) : null}
						{hidden ? null : value !== 0 ? (
							<span
								className={`text-[clamp(1.15rem,5vw,2rem)] font-semibold leading-none ${
									isConflict
										? "text-red-500 dark:text-red-400"
										: isGiven
											? "text-slate-900 dark:text-slate-100"
											: "text-sky-600 dark:text-sky-300"
								}`}
							>
								{value}
							</span>
						) : (
							<>
								{digitsInMask(board.corner[cell]).map((digit, index) => (
									<span
										key={digit}
										className={`absolute text-[clamp(0.5rem,1.7vw,0.72rem)] font-semibold leading-tight text-slate-600 dark:text-slate-300 ${
											CORNER_SLOTS[index] ?? CORNER_SLOTS[7]
										}`}
									>
										{digit}
									</span>
								))}
								{board.center[cell] !== 0 ? (
									<span className="text-[clamp(0.5rem,1.9vw,0.82rem)] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
										{digitsInMask(board.center[cell]).join("")}
									</span>
								) : null}
							</>
						)}
					</button>
				);
			})}
		</div>
	);
}
