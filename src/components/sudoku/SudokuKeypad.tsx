import { Eraser, Lightbulb, Palette, Pencil, Redo2, Undo2 } from "lucide-react";
import type { SudokuInputMode } from "#/lib/games/sudoku-board";
import { SUDOKU_COLOR_SWATCHES } from "./SudokuBoard";

const MODES: { id: SudokuInputMode; label: string }[] = [
	{ id: "digit", label: "Digit" },
	{ id: "corner", label: "Corner" },
	{ id: "center", label: "Center" },
	{ id: "color", label: "Color" },
];

export type SudokuKeypadProps = {
	mode: SudokuInputMode;
	onModeChange: (mode: SudokuInputMode) => void;
	onDigit: (digit: number) => void;
	onColor: (color: number) => void;
	onErase: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onHint: () => void;
	canUndo: boolean;
	canRedo: boolean;
	digitCounts: number[];
	disabled?: boolean;
};

const toolButton =
	"flex items-center justify-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/70 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";

export function SudokuKeypad({
	mode,
	onModeChange,
	onDigit,
	onColor,
	onErase,
	onUndo,
	onRedo,
	onHint,
	canUndo,
	canRedo,
	digitCounts,
	disabled = false,
}: SudokuKeypadProps) {
	return (
		<div className="flex w-full max-w-[min(92vw,540px)] flex-col gap-2">
			<div className="grid grid-cols-4 gap-1.5">
				{MODES.map((entry) => (
					<button
						key={entry.id}
						type="button"
						disabled={disabled}
						onClick={() => onModeChange(entry.id)}
						className={`rounded-md px-2 py-1.5 text-xs font-bold transition ${
							mode === entry.id
								? "bg-sky-400 text-slate-950"
								: "border border-slate-600/70 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
						} disabled:cursor-not-allowed disabled:opacity-40`}
					>
						{entry.id === "corner" ? (
							<span className="inline-flex items-center gap-1">
								<Pencil className="h-3 w-3" /> {entry.label}
							</span>
						) : entry.id === "color" ? (
							<span className="inline-flex items-center gap-1">
								<Palette className="h-3 w-3" /> {entry.label}
							</span>
						) : (
							entry.label
						)}
					</button>
				))}
			</div>
			{mode === "color" ? (
				<div className="grid grid-cols-8 gap-1.5">
					{SUDOKU_COLOR_SWATCHES.map((swatch, index) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed palette
							key={index}
							type="button"
							disabled={disabled}
							onClick={() => onColor(index + 1)}
							aria-label={`Color ${index + 1}`}
							className={`aspect-square rounded-md ${swatch} transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40`}
						/>
					))}
				</div>
			) : (
				<div className="grid grid-cols-9 gap-1.5">
					{Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => {
						const remaining = 9 - (digitCounts[digit] ?? 0);
						return (
							<button
								key={digit}
								type="button"
								disabled={disabled}
								onClick={() => onDigit(digit)}
								className="flex flex-col items-center rounded-md border border-slate-600/70 bg-slate-800/70 py-1.5 font-bold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<span className="text-lg leading-none">{digit}</span>
								<span className="text-[0.6rem] font-normal text-slate-400">
									{remaining > 0 ? remaining : "✓"}
								</span>
							</button>
						);
					})}
				</div>
			)}
			<div className="grid grid-cols-4 gap-1.5">
				<button
					type="button"
					className={toolButton}
					onClick={onUndo}
					disabled={disabled || !canUndo}
				>
					<Undo2 className="h-4 w-4" /> Undo
				</button>
				<button
					type="button"
					className={toolButton}
					onClick={onRedo}
					disabled={disabled || !canRedo}
				>
					<Redo2 className="h-4 w-4" /> Redo
				</button>
				<button
					type="button"
					className={toolButton}
					onClick={onErase}
					disabled={disabled}
				>
					<Eraser className="h-4 w-4" /> Erase
				</button>
				<button
					type="button"
					className={toolButton}
					onClick={onHint}
					disabled={disabled}
				>
					<Lightbulb className="h-4 w-4" /> Hint
				</button>
			</div>
		</div>
	);
}
