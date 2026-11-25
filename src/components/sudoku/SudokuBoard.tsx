import { colOf, digitsInMask, rowOf } from "@arcadeclub/core/sudoku";
import type {
	SudokuBoardState,
	SudokuInputMode,
} from "@arcadeclub/core/sudoku-board";
import { effectiveGrid } from "@arcadeclub/core/sudoku-board";
import {
	type CornerNoteLayout,
	type CornerNoteSlot,
	cornerNoteGroups,
} from "@arcadeclub/core/sudoku-input";
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

const CORNER_SLOTS: Record<CornerNoteSlot, string> = {
	topLeft: "left-0.5 top-0",
	topRight: "right-0.5 top-0",
	bottomLeft: "left-0.5 bottom-0",
	bottomRight: "right-0.5 bottom-0",
	top: "left-1/2 top-0 -translate-x-1/2",
	bottom: "left-1/2 bottom-0 -translate-x-1/2",
	left: "left-0.5 top-1/2 -translate-y-1/2",
	right: "right-0.5 top-1/2 -translate-y-1/2",
};

type SudokuBoardProps = {
	board: SudokuBoardState;
	selectedCell: number | null;
	onSelectCell?: (cell: number) => void;
	conflicts?: ReadonlySet<number>;
	hintCells?: ReadonlySet<number>;
	/** The lines a fully explained fish or single-digit pattern uses. */
	hintLines?: ReadonlySet<number>;
	/** A fully explained chain, colouring or ALS pair, in two tones. */
	hintTones?: readonly [ReadonlySet<number>, ReadonlySet<number>];
	hidden?: boolean;
	className?: string;
	/** Killer sudoku cages: dashed outlines plus a sum in each cage's corner. */
	cages?: KillerCage[];
	/** Outside digit mode the selected cell gets a ring on its edge. */
	mode?: SudokuInputMode;
	cornerLayout?: CornerNoteLayout;
};

export function SudokuBoard({
	board,
	selectedCell,
	onSelectCell,
	conflicts,
	hintCells,
	hintLines,
	hintTones,
	hidden = false,
	className = "",
	cages,
	mode = "digit",
	cornerLayout = "spread",
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
			className={`puzzle-board grid aspect-square w-full touch-manipulation select-none grid-cols-9 grid-rows-9 rounded-lg border-2 border-slate-600 bg-white shadow-lg dark:border-slate-300/80 dark:bg-slate-900 ${className}`}
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
				const isHintLine = hintLines?.has(cell) ?? false;
				const tone = hintTones?.[0].has(cell)
					? "bg-emerald-300/50 dark:bg-emerald-300/25"
					: hintTones?.[1].has(cell)
						? "bg-pink-300/50 dark:bg-pink-300/25"
						: "";
				const colorClass = SUDOKU_COLORS[board.colors[cell] - 1]?.tint ?? "";

				// The board's own `border-2` is the outer edge, so cells on the edge
				// draw no border there; box lines inside are 2px, cell lines 1px.
				const borders = [
					col === 0
						? ""
						: col % 3 === 0
							? "border-l-2 border-l-slate-600 dark:border-l-slate-300/70"
							: "border-l border-l-[var(--puzzle-line)]",
					row === 0
						? ""
						: row % 3 === 0
							? "border-t-2 border-t-slate-600 dark:border-t-slate-300/70"
							: "border-t border-t-[var(--puzzle-line)]",
				].join(" ");

				// The board's rounded corner is 2px smaller inside its border; the
				// corner cells follow it so a filled one stays inside the edge.
				const corner =
					row === 0 && col === 0
						? "rounded-tl-[calc(0.5rem-2px)]"
						: row === 0 && col === 8
							? "rounded-tr-[calc(0.5rem-2px)]"
							: row === 8 && col === 0
								? "rounded-bl-[calc(0.5rem-2px)]"
								: row === 8 && col === 8
									? "rounded-br-[calc(0.5rem-2px)]"
									: "";

				// Outside digit mode the selected cell also gets a solid ring on
				// its edge: clear of the notes, and unlike the dashed cage lines.
				const modeRing =
					isSelected && mode !== "digit"
						? "inset-ring-2 inset-ring-sky-700 dark:inset-ring-sky-300"
						: "";

				// The line beside a filled cell drops to about 2:1 in dark mode, so a
				// selected (in digit mode), hinted, same-digit or colour-marked cell
				// carries its own 3:1 edge: the box-line colour, one pixel inside.
				const filledRing =
					!modeRing && (isSelected || isHint || tone || sameDigit || colorClass)
						? "inset-ring-1 inset-ring-slate-600 dark:inset-ring-slate-300/70"
						: "";

				// One fill per cell, so no two `bg-*` classes compete (Tailwind's
				// stylesheet order, not the class order, would pick the winner).
				// Order: selected, colour mark, hint tone, hint, hint line, same
				// digit, peer.
				// The selected fill stays on a marked cell so the player can see
				// where they are.
				const background = isSelected
					? "bg-sky-300/60 dark:bg-sky-400/30"
					: colorClass ||
						tone ||
						(isHint
							? "bg-amber-300/50 dark:bg-amber-300/25"
							: isHintLine
								? "bg-amber-300/20 dark:bg-amber-300/10"
								: sameDigit
									? "bg-sky-400/25 dark:bg-sky-500/20"
									: isPeer
										? "bg-slate-200 dark:bg-slate-700/40"
										: "");

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
						className={`@container relative flex items-center justify-center overflow-hidden p-0 ${borders} ${corner} ${background} ${modeRing} ${filledRing} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300`}
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
								{cageEdges ? (
									// In a Killer cage the notes sit inside a box a little in from
									// the cell edge, clear of the dashed cage lines (inset 2px, 1px wide).
									<span className="pointer-events-none absolute inset-[3px]">
										<CornerNotes
											mask={board.corner[cell]}
											layout={cornerLayout}
										/>
									</span>
								) : (
									<CornerNotes
										mask={board.corner[cell]}
										layout={cornerLayout}
									/>
								)}
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

function CornerNotes({
	mask,
	layout,
}: {
	mask: number;
	layout: CornerNoteLayout;
}) {
	return cornerNoteGroups(mask, layout).map((group) =>
		layout === "topRight" ? (
			// One line that shrinks with the cell (cqw) rather than wrapping
			// into the center notes; the class is the fallback where container
			// units are unsupported.
			<span
				key={group.slot}
				className="absolute inset-x-0.5 top-0 whitespace-nowrap text-right text-[clamp(0.5rem,1.7vw,0.72rem)] font-semibold leading-tight text-slate-600 dark:text-slate-300"
				style={{
					fontSize: `min(clamp(0.5rem, 1.7vw, 0.72rem), calc((100cqw - 0.25rem) / ${(group.digits.length * 0.62).toFixed(2)}))`,
				}}
			>
				{group.digits.join("")}
			</span>
		) : (
			<span
				key={group.slot}
				className={`absolute whitespace-nowrap text-[clamp(0.5rem,1.7vw,0.72rem)] font-semibold leading-tight text-slate-600 dark:text-slate-300 ${
					CORNER_SLOTS[group.slot]
				}`}
			>
				{group.digits.join("")}
			</span>
		),
	);
}
