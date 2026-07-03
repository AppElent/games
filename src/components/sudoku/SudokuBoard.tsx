import { colOf, digitsInMask, rowOf } from "#/lib/games/sudoku";
import type { SudokuBoardState } from "#/lib/games/sudoku-board";
import { effectiveGrid } from "#/lib/games/sudoku-board";

export const SUDOKU_COLOR_CLASSES = [
	"", // 0 = none
	"bg-sky-500/40",
	"bg-emerald-500/40",
	"bg-amber-500/40",
	"bg-rose-500/40",
	"bg-violet-500/40",
	"bg-teal-500/40",
	"bg-orange-500/40",
	"bg-pink-500/40",
];

export const SUDOKU_COLOR_SWATCHES = [
	"bg-sky-500",
	"bg-emerald-500",
	"bg-amber-500",
	"bg-rose-500",
	"bg-violet-500",
	"bg-teal-500",
	"bg-orange-500",
	"bg-pink-500",
];

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

export type SudokuHighlightSettings = {
	peers: boolean;
	matchingDigits: boolean;
};

export type SudokuBoardProps = {
	board: SudokuBoardState;
	selectedCell: number | null;
	onSelectCell?: (cell: number) => void;
	conflicts?: ReadonlySet<number>;
	hintCells?: ReadonlySet<number>;
	highlight?: SudokuHighlightSettings;
	hidden?: boolean;
	className?: string;
};

export function SudokuBoard({
	board,
	selectedCell,
	onSelectCell,
	conflicts,
	hintCells,
	highlight = { peers: true, matchingDigits: true },
	hidden = false,
	className = "",
}: SudokuBoardProps) {
	const grid = effectiveGrid(board);
	const selectedDigit =
		selectedCell !== null && grid[selectedCell] !== 0 ? grid[selectedCell] : 0;
	const selRow = selectedCell !== null ? rowOf(selectedCell) : -1;
	const selCol = selectedCell !== null ? colOf(selectedCell) : -1;
	const selBoxRow = selRow >= 0 ? Math.floor(selRow / 3) : -1;
	const selBoxCol = selCol >= 0 ? Math.floor(selCol / 3) : -1;

	return (
		<div
			className={`grid aspect-square w-full max-w-[min(92vw,540px)] select-none grid-cols-9 grid-rows-9 rounded-lg border-2 border-slate-300/80 bg-slate-900 ${className}`}
		>
			{grid.map((value, cell) => {
				const row = rowOf(cell);
				const col = colOf(cell);
				const isGiven = board.givens[cell] !== 0;
				const isSelected = cell === selectedCell;
				const isPeer =
					highlight.peers &&
					!isSelected &&
					selectedCell !== null &&
					(row === selRow ||
						col === selCol ||
						(Math.floor(row / 3) === selBoxRow &&
							Math.floor(col / 3) === selBoxCol));
				const sameDigit =
					highlight.matchingDigits &&
					selectedDigit !== 0 &&
					value === selectedDigit &&
					!isSelected;
				const isConflict = conflicts?.has(cell) ?? false;
				const isHint = hintCells?.has(cell) ?? false;
				const colorClass = SUDOKU_COLOR_CLASSES[board.colors[cell]] ?? "";

				const borders = [
					col % 3 === 0
						? "border-l-2 border-l-slate-300/70"
						: "border-l border-l-slate-600/60",
					row % 3 === 0
						? "border-t-2 border-t-slate-300/70"
						: "border-t border-t-slate-600/60",
					col === 8 ? "border-r-2 border-r-slate-300/70" : "",
					row === 8 ? "border-b-2 border-b-slate-300/70" : "",
				].join(" ");

				const background = isSelected
					? "bg-sky-400/30"
					: isHint
						? "bg-amber-300/25"
						: sameDigit
							? "bg-sky-500/20"
							: isPeer
								? "bg-slate-700/40"
								: "";

				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed 81-cell grid
						key={cell}
						type="button"
						aria-label={`Row ${row + 1} column ${col + 1}`}
						onClick={() => onSelectCell?.(cell)}
						className={`relative flex items-center justify-center overflow-hidden p-0 ${borders} ${colorClass} ${background} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300`}
					>
						{hidden ? null : value !== 0 ? (
							<span
								className={`text-[clamp(1rem,4.2vw,1.75rem)] font-semibold leading-none ${
									isConflict
										? "text-red-400"
										: isGiven
											? "text-slate-100"
											: "text-sky-300"
								}`}
							>
								{value}
							</span>
						) : (
							<>
								{digitsInMask(board.corner[cell]).map((digit, index) => (
									<span
										key={digit}
										className={`absolute text-[clamp(0.4rem,1.4vw,0.6rem)] font-medium leading-tight text-slate-300 ${
											CORNER_SLOTS[index] ?? CORNER_SLOTS[7]
										}`}
									>
										{digit}
									</span>
								))}
								{board.center[cell] !== 0 ? (
									<span className="text-[clamp(0.4rem,1.6vw,0.7rem)] font-medium tracking-tight text-slate-300">
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
