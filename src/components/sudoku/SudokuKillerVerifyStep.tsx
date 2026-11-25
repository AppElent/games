import type { CageEdge, KillerScan } from "@arcadeclub/core/sudoku-scan-cages";
import {
	checkKillerScan,
	edgeBetween,
	edgeKey,
	type KillerScanCheck,
	killerScanCages,
	parseCageSum,
	setKillerSum,
	toggleKillerBorder,
} from "@arcadeclub/core/sudoku-scan-cages";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { autoSessionTitle } from "#/lib/games/sudoku-local";
import { createSudokuSession } from "#/lib/games/sudoku-session";
import { useHostSession } from "#/lib/games/use-host-session";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { nextGridIndex } from "./scan-grid-keys";

const GRID_SIZE = 9;

type Direction = "up" | "right" | "down" | "left";

/** The neighbour of `cell` in `direction`, or null at the grid's edge. */
function neighbor(cell: number, direction: Direction) {
	const row = Math.floor(cell / GRID_SIZE);
	const col = cell % GRID_SIZE;
	switch (direction) {
		case "up":
			return row > 0 ? cell - GRID_SIZE : null;
		case "down":
			return row < GRID_SIZE - 1 ? cell + GRID_SIZE : null;
		case "left":
			return col > 0 ? cell - 1 : null;
		case "right":
			return col < GRID_SIZE - 1 ? cell + 1 : null;
	}
}

/**
 * Checks a Killer read from a photo: the cages drawn from the dashes found,
 * the sums read in their corners, and the lines the read was unsure of in
 * amber. Picking a cell shows its cage's sum to correct and the four lines
 * around it to draw or remove.
 */
export function KillerVerifyStep({
	warpedUrl,
	scan,
	onScanChange,
	onRescan,
	onReadAsClassic,
	onError,
}: {
	warpedUrl: string;
	scan: KillerScan;
	onScanChange: (scan: KillerScan) => void;
	onRescan: () => void;
	/** For a classic grid the cage read mistook for a Killer. */
	onReadAsClassic: () => void;
	onError: (message: string) => void;
}) {
	const { locale, messages } = useI18n();
	const sudoku = messages.games.sudoku;
	const killer = sudoku.scan.killer;
	const create = useMutation(api.sudoku.create);
	const { busy, error, host } = useHostSession("sudoku");
	const cages = useMemo(() => killerScanCages(scan), [scan]);
	const cageOf = useMemo(() => {
		const byCell = new Array<number>(GRID_SIZE * GRID_SIZE).fill(-1);
		cages.forEach((cage, index) => {
			for (const cell of cage.cells) {
				byCell[cell] = index;
			}
		});
		return byCell;
	}, [cages]);
	const borders = useMemo(() => new Set(scan.borders), [scan.borders]);
	const doubtful = useMemo(() => new Set(scan.doubtful), [scan.doubtful]);
	const check = useMemo(
		() => checkKillerScan(scan, { checkUnique: false }),
		[scan],
	);

	const [selected, setSelected] = useState<number>(() => {
		const missing = cages.find((cage) => cage.sum === null);
		if (missing) {
			return missing.cells[0];
		}
		const unsure = scan.doubtful[0];
		return unsure ? Number.parseInt(unsure, 10) : 0;
	});
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const gridLabelId = useId();
	const sumFieldId = useId();
	const sumHintId = useId();
	const tabStop = focusIndex ?? selected;

	const cage = cages[cageOf[selected]];
	const [sumText, setSumText] = useState(
		cage?.sum !== null && cage ? String(cage.sum) : "",
	);
	// The field shows the selected cage's sum; it follows a new selection.
	const cageKey = cage?.cells[0];
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when another cage is picked
	useEffect(() => {
		setSumText(cage?.sum != null ? String(cage.sum) : "");
	}, [cageKey]);

	useEffect(() => {
		if (error) {
			onError(error);
		}
	}, [error, onError]);

	const sumTextValid = sumText.trim() === "" || parseCageSum(sumText.trim());
	const onSumChange = (text: string) => {
		setSumText(text);
		const trimmed = text.trim();
		if (trimmed === "") {
			onScanChange(setKillerSum(scan, selected, null));
			return;
		}
		const sum = parseCageSum(trimmed);
		if (sum !== null) {
			onScanChange(setKillerSum(scan, selected, sum));
		}
	};

	const onCellKeyDown = (index: number, event: React.KeyboardEvent) => {
		const next = nextGridIndex(index, event.key);
		if (next === null) {
			return;
		}
		event.preventDefault();
		setFocusIndex(next);
		cellRefs.current[next]?.focus();
	};

	const lineButtons: { direction: Direction; label: string }[] = [
		{ direction: "up", label: killer.lineUp },
		{ direction: "right", label: killer.lineRight },
		{ direction: "down", label: killer.lineDown },
		{ direction: "left", label: killer.lineLeft },
	];

	const cellName = (cell: number) => {
		const entry = cages[cageOf[cell]];
		const values = {
			row: Math.floor(cell / GRID_SIZE) + 1,
			col: (cell % GRID_SIZE) + 1,
			count: entry?.cells.length ?? 1,
			sum: entry?.sum ?? 0,
		};
		return fmt(
			entry?.sum == null ? killer.cellNameNoSum : killer.cellName,
			values,
		);
	};

	// Counting solutions takes about a second, so it runs on confirm only.
	const [confirmCheck, setConfirmCheck] = useState<{
		scan: KillerScan;
		check: KillerScanCheck;
	} | null>(null);
	const shownCheck =
		check ?? (confirmCheck?.scan === scan ? confirmCheck.check : null);

	const describeCheck = (entry: KillerScanCheck) => {
		switch (entry.kind) {
			case "missingSums":
				return plural(locale, entry.count, killer.missingSums);
			case "total":
				return fmt(killer.total, { total: entry.total });
			case "notUnique":
				return entry.solutions === 0 ? killer.noSolution : killer.manySolutions;
			case "invalidCages":
				return killer.invalidCages;
		}
	};

	const confirm = () => {
		const full = checkKillerScan(scan);
		if (full) {
			setConfirmCheck({ scan, check: full });
			return;
		}
		return host(async ({ displayName, guestId }) => {
			const title = autoSessionTitle(undefined, "scan");
			return createSudokuSession(create, {
				title,
				displayName,
				guestId,
				source: "scan",
				variant: "killer",
				cages: cages.map((entry) => ({
					cells: entry.cells,
					sum: entry.sum ?? 0,
				})),
				givens: "0".repeat(GRID_SIZE * GRID_SIZE),
			});
		}, sudoku.scan.couldNotCreateSession);
	};

	const unsureCount = scan.doubtful.length;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start gap-4">
				<div>
					<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
						{sudoku.scan.scannedImageLabel}
					</p>
					<img
						src={warpedUrl}
						alt={sudoku.scan.correctedGridAlt}
						className="w-40 rounded-md border border-slate-700 sm:w-56"
					/>
				</div>
				<div className="min-w-[260px] flex-1">
					<p
						id={gridLabelId}
						className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400"
					>
						{killer.gridLabel}
					</p>
					{/* biome-ignore lint/a11y/useSemanticElements: CSS grid of divs keeps the visual layout; table elements would not */}
					<div
						role="grid"
						aria-labelledby={gridLabelId}
						className="grid aspect-square w-full max-w-[420px] grid-rows-9 rounded-md border-2 border-slate-300/80 bg-slate-900"
					>
						{Array.from({ length: GRID_SIZE }, (_, row) => (
							// biome-ignore lint/a11y/useFocusableInteractive: focus lives on the button inside each gridcell (roving tabindex)
							// biome-ignore lint/a11y/useSemanticElements: see the grid above
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 9-row grid
								key={row}
								role="row"
								className="grid grid-cols-9"
							>
								{Array.from({ length: GRID_SIZE }, (_, col) => {
									const cell = row * GRID_SIZE + col;
									const index = cageOf[cell];
									const entry = cages[index];
									const differs = (other: number | null) =>
										other === null || cageOf[other] !== index;
									const sides = {
										top: differs(neighbor(cell, "up")),
										bottom: differs(neighbor(cell, "down")),
										left: differs(neighbor(cell, "left")),
										right: differs(neighbor(cell, "right")),
									};
									const gridLines = [
										col % 3 === 0
											? "border-l-2 border-l-slate-300/70"
											: "border-l border-l-[var(--club-line-strong)]",
										row % 3 === 0
											? "border-t-2 border-t-slate-300/70"
											: "border-t border-t-[var(--club-line-strong)]",
									].join(" ");
									const inSelectedCage = index === cageOf[selected];
									const isFirst = entry?.cells[0] === cell;
									const unsureRight = doubtful.has(`${cell}r`);
									const unsureBottom = doubtful.has(`${cell}b`);
									return (
										// biome-ignore lint/a11y/useFocusableInteractive: focus lives on the button inside (roving tabindex)
										// biome-ignore lint/a11y/useSemanticElements: see the grid above
										<div
											key={cell}
											role="gridcell"
											aria-selected={selected === cell}
											className={`relative flex min-h-0 min-w-0 ${gridLines} ${
												inSelectedCage ? "bg-sky-400/20" : ""
											}`}
										>
											<button
												ref={(node) => {
													cellRefs.current[cell] = node;
												}}
												type="button"
												aria-label={cellName(cell)}
												tabIndex={cell === tabStop ? 0 : -1}
												onClick={() => {
													setSelected(cell);
													setFocusIndex(cell);
												}}
												onFocus={() => setFocusIndex(cell)}
												onKeyDown={(event) => onCellKeyDown(cell, event)}
												className={`relative flex min-w-0 flex-1 outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-[var(--club-cyan)] focus-visible:shadow-[0_0_0_4px_var(--club-on-accent)] ${
													selected === cell
														? "ring-2 ring-inset ring-[var(--club-cyan)]"
														: ""
												}`}
											>
												<span
													aria-hidden="true"
													className="pointer-events-none absolute border-dashed border-slate-300/70"
													style={{
														top: sides.top ? 3 : 0,
														bottom: sides.bottom ? 3 : 0,
														left: sides.left ? 3 : 0,
														right: sides.right ? 3 : 0,
														borderTopWidth: sides.top ? 1 : 0,
														borderBottomWidth: sides.bottom ? 1 : 0,
														borderLeftWidth: sides.left ? 1 : 0,
														borderRightWidth: sides.right ? 1 : 0,
													}}
												/>
												{isFirst ? (
													<span
														aria-hidden="true"
														className={`pointer-events-none absolute left-1 top-0.5 text-[clamp(0.55rem,2vw,0.75rem)] font-bold leading-none ${
															entry?.sum == null
																? "rounded-sm bg-amber-400 px-0.5 text-slate-950"
																: "text-slate-100"
														}`}
													>
														{entry?.sum ?? "?"}
													</span>
												) : null}
											</button>
											{unsureRight ? (
												<span
													aria-hidden="true"
													className="pointer-events-none absolute -right-[3px] top-1 bottom-1 z-10 w-[5px] rounded-full bg-amber-400"
												/>
											) : null}
											{unsureBottom ? (
												<span
													aria-hidden="true"
													className="pointer-events-none absolute -bottom-[3px] left-1 right-1 z-10 h-[5px] rounded-full bg-amber-400"
												/>
											) : null}
										</div>
									);
								})}
							</div>
						))}
					</div>
					<p className="mt-1 text-xs text-slate-400">
						{unsureCount > 0
							? plural(locale, unsureCount, killer.unsureLines)
							: killer.allLinesSure}
					</p>
				</div>
			</div>

			{cage ? (
				<div className="max-w-xl rounded-lg border border-slate-600/70 bg-slate-800/60 p-4">
					<p className="mb-3 text-sm font-bold text-white">
						{fmt(sudoku.scan.cellLabel, {
							row: Math.floor(selected / GRID_SIZE) + 1,
							col: (selected % GRID_SIZE) + 1,
						})}
						<span className="ml-2 font-semibold text-slate-300">
							{plural(locale, cage.cells.length, killer.cageLabel)}
						</span>
					</p>
					<div className="mb-4 flex flex-wrap items-center gap-3">
						<label
							htmlFor={sumFieldId}
							className="text-sm font-semibold text-slate-200"
						>
							{killer.sumLabel}
						</label>
						<input
							id={sumFieldId}
							type="text"
							inputMode="numeric"
							autoComplete="off"
							value={sumText}
							aria-invalid={!sumTextValid}
							aria-describedby={sumHintId}
							onChange={(event) => onSumChange(event.target.value)}
							className="club-field w-20 rounded-md px-3 py-2 text-base font-bold"
						/>
						<span
							id={sumHintId}
							className={`text-xs ${sumTextValid ? "text-slate-400" : "club-error"}`}
						>
							{killer.sumHint}
						</span>
					</div>
					<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
						{killer.linesLabel}
					</p>
					<div className="flex flex-wrap gap-1.5">
						{lineButtons.map(({ direction, label }) => {
							const other = neighbor(selected, direction);
							const edge: CageEdge | null =
								other === null ? null : edgeBetween(selected, other);
							// The grid's own edge is always a cage line: nothing to toggle.
							if (!edge) {
								return null;
							}
							const key = edgeKey(edge);
							const on = borders.has(key);
							const unsure = doubtful.has(key);
							return (
								<button
									key={direction}
									type="button"
									aria-pressed={on}
									onClick={() => onScanChange(toggleKillerBorder(scan, edge))}
									className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${
										on
											? "bg-sky-400 text-slate-950"
											: "club-btn-outline text-slate-300 hover:bg-slate-700"
									}`}
								>
									{label}
									{unsure ? (
										<span className="rounded bg-amber-400 px-1 text-[0.65rem] text-slate-950">
											{killer.unsure}
										</span>
									) : null}
								</button>
							);
						})}
					</div>
				</div>
			) : null}

			<div className="max-w-xl">
				{shownCheck ? (
					<p
						role="status"
						className="mb-3 rounded-md border border-orange-400/40 bg-orange-500/10 px-4 py-3 club-error"
					>
						{describeCheck(shownCheck)}
					</p>
				) : (
					<p className="mb-3 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
						{killer.ready}
					</p>
				)}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={onRescan}
						className="rounded-md club-btn-outline px-4 py-2 font-semibold text-slate-300"
					>
						{sudoku.scan.startOver}
					</button>
					<button
						type="button"
						disabled={shownCheck !== null || busy}
						onClick={confirm}
						className="inline-flex items-center gap-2 club-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Check className="h-4 w-4" />
						{busy ? sudoku.scan.creatingPuzzle : sudoku.scan.confirmAndPlay}
					</button>
				</div>
				<button
					type="button"
					onClick={onReadAsClassic}
					className="mt-3 text-sm font-semibold text-slate-300 underline underline-offset-4 hover:text-white"
				>
					{killer.readAsClassic}
				</button>
			</div>
		</div>
	);
}
