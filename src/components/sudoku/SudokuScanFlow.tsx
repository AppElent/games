import { digitsToString } from "@arcadeclub/core/puzzle";
import { digitsInMask } from "@arcadeclub/core/sudoku";
import type { ScanCell, ScanCellType } from "@arcadeclub/core/sudoku-scan";
import {
	clearScanCell,
	describeScanErrors,
	isLowConfidence,
	scanResultToBoardState,
	setScanCellDigit,
	setScanCellType,
	toggleScanCellNote,
	validateScanResult,
} from "@arcadeclub/core/sudoku-scan";
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import { defaultCorners } from "@arcadeclub/core/sudoku-scan-ink";
import { useMutation } from "convex/react";
import { Camera, Check, Loader2, Upload } from "lucide-react";
import {
	useEffect,
	useEffectEvent,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { findGridCorners } from "#/lib/games/sudoku-grid-finder";
import { autoSessionTitle } from "#/lib/games/sudoku-local";
import type { ScanProgress } from "#/lib/games/sudoku-scan-image";
import {
	fileToCanvas,
	recognizeGrid,
	warpToSquare,
} from "#/lib/games/sudoku-scan-image";
import { createSudokuSession } from "#/lib/games/sudoku-session";
import { useGameAction } from "#/lib/games/use-game-action";
import { useHostSession } from "#/lib/games/use-host-session";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { SudokuBoard } from "./SudokuBoard";

type Step =
	| { id: "upload" }
	/** `corners` is null while the grid is being looked for. */
	| { id: "corners"; source: HTMLCanvasElement; corners: Point[] | null }
	| { id: "recognizing"; warpedUrl: string; progress: ScanProgress }
	| { id: "verify"; warpedUrl: string; cells: ScanCell[] };

export function SudokuScanFlow() {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const [step, setStep] = useState<Step>({ id: "upload" });
	const { error, setError, run } = useGameAction();

	const onFile = async (file: File | undefined) => {
		if (!file) {
			return;
		}
		await run(async () => {
			const source = await fileToCanvas(file);
			setStep({ id: "corners", source, corners: null });
		}, sudoku.scan.couldNotReadImage);
	};

	const runRecognition = async (
		source: HTMLCanvasElement,
		corners: Point[],
	) => {
		const read = await run(async () => {
			const warped = warpToSquare(source, corners);
			const warpedUrl = warped.toDataURL("image/jpeg", 0.8);
			setStep({
				id: "recognizing",
				warpedUrl,
				progress: { step: "preparing", cellsDone: 0, cellsTotal: 81 },
			});
			const cells = await recognizeGrid(warped, (progress) =>
				setStep((current) =>
					current.id === "recognizing" ? { ...current, progress } : current,
				),
			);
			setStep({ id: "verify", warpedUrl, cells });
		}, sudoku.scan.recognitionFailed);
		if (!read) {
			setStep({ id: "upload" });
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{error ? <p className="club-error">{error}</p> : null}
			{step.id === "upload" ? <UploadStep onFile={onFile} /> : null}
			{step.id === "corners" ? (
				<CornerStep
					source={step.source}
					corners={step.corners}
					onChange={(corners) => setStep({ ...step, corners })}
					onConfirm={(corners) => runRecognition(step.source, corners)}
					onBack={() => setStep({ id: "upload" })}
				/>
			) : null}
			{step.id === "recognizing" ? (
				<div className="flex flex-col items-center gap-3 py-8 text-slate-300">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p>
						{step.progress.step === "preparing"
							? sudoku.scan.preparingImage
							: fmt(sudoku.scan.readingCells, {
									done: step.progress.cellsDone,
									total: step.progress.cellsTotal,
								})}
					</p>
					<img
						src={step.warpedUrl}
						alt={sudoku.scan.correctedGridAlt}
						className="w-48 rounded-md border border-slate-700 opacity-70"
					/>
				</div>
			) : null}
			{step.id === "verify" ? (
				<VerifyStep
					warpedUrl={step.warpedUrl}
					cells={step.cells}
					onCellsChange={(cells) => setStep({ ...step, cells })}
					onRescan={() => setStep({ id: "upload" })}
					onError={setError}
				/>
			) : null}
		</div>
	);
}

function UploadStep({ onFile }: { onFile: (file: File | undefined) => void }) {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const uploadRef = useRef<HTMLInputElement>(null);
	const cameraRef = useRef<HTMLInputElement>(null);
	return (
		<div className="flex max-w-xl flex-col gap-3">
			<p className="text-slate-300">{sudoku.scan.uploadInstructions}</p>
			<input
				ref={uploadRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(event) => onFile(event.target.files?.[0])}
			/>
			<input
				ref={cameraRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={(event) => onFile(event.target.files?.[0])}
			/>
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => cameraRef.current?.click()}
					className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 font-bold text-slate-950"
				>
					<Camera className="h-5 w-5" /> {sudoku.scan.takePhoto}
				</button>
				<button
					type="button"
					onClick={() => uploadRef.current?.click()}
					className="inline-flex items-center gap-2 rounded-md club-btn-outline bg-slate-800/60 px-5 py-3 font-bold text-slate-200"
				>
					<Upload className="h-5 w-5" /> {sudoku.scan.uploadImage}
				</button>
			</div>
		</div>
	);
}

const KEYBOARD_STEP_RATIO = 0.005;
const KEYBOARD_SHIFT_STEP_RATIO = 0.05;

function CornerStep({
	source,
	corners,
	onChange,
	onConfirm,
	onBack,
}: {
	source: HTMLCanvasElement;
	corners: Point[] | null;
	onChange: (corners: Point[]) => void;
	onConfirm: (corners: Point[]) => void;
	onBack: () => void;
}) {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const containerRef = useRef<HTMLDivElement>(null);
	const [imageUrl] = useState(() => source.toDataURL("image/jpeg", 0.8));
	const dragIndex = useRef<number | null>(null);

	const placeCorners = useEffectEvent(onChange);
	useEffect(() => {
		const controller = new AbortController();
		findGridCorners(source, controller.signal).then((found) => {
			if (!controller.signal.aborted) {
				placeCorners(found ?? defaultCorners(source.width, source.height));
			}
		});
		return () => controller.abort();
	}, [source]);

	const polygonPoints = corners?.map((p) => `${p.x},${p.y}`).join(" ") ?? "";

	const clampPoint = (x: number, y: number): Point => ({
		x: Math.max(0, Math.min(source.width, x)),
		y: Math.max(0, Math.min(source.height, y)),
	});

	const toSourcePoint = (event: React.PointerEvent) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) {
			return null;
		}
		const x = ((event.clientX - rect.left) / rect.width) * source.width;
		const y = ((event.clientY - rect.top) / rect.height) * source.height;
		return clampPoint(x, y);
	};

	const moveCornerBy = (index: number, dx: number, dy: number) => {
		if (!corners) {
			return;
		}
		const current = corners[index];
		const moved = clampPoint(current.x + dx, current.y + dy);
		if (moved.x === current.x && moved.y === current.y) {
			return;
		}
		const next = [...corners];
		next[index] = moved;
		onChange(next);
	};

	const onHandleKeyDown = (index: number, event: React.KeyboardEvent) => {
		const step = Math.max(
			1,
			Math.round(
				Math.max(source.width, source.height) *
					(event.shiftKey ? KEYBOARD_SHIFT_STEP_RATIO : KEYBOARD_STEP_RATIO),
			),
		);
		switch (event.key) {
			case "ArrowLeft":
				event.preventDefault();
				moveCornerBy(index, -step, 0);
				break;
			case "ArrowRight":
				event.preventDefault();
				moveCornerBy(index, step, 0);
				break;
			case "ArrowUp":
				event.preventDefault();
				moveCornerBy(index, 0, -step);
				break;
			case "ArrowDown":
				event.preventDefault();
				moveCornerBy(index, 0, step);
				break;
			default:
				break;
		}
	};

	return (
		<div className="flex max-w-xl flex-col gap-3">
			<p className="text-slate-300">
				{sudoku.scan.dragCorners} {sudoku.scan.cornerKeyboardHint}
			</p>
			<div
				ref={containerRef}
				className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-slate-600"
				onPointerMove={(event) => {
					if (dragIndex.current === null || !corners) {
						return;
					}
					const point = toSourcePoint(event);
					if (!point) {
						return;
					}
					const next = [...corners];
					next[dragIndex.current] = point;
					onChange(next);
				}}
				onPointerUp={() => {
					dragIndex.current = null;
				}}
			>
				<img
					src={imageUrl}
					alt={sudoku.scan.uploadedImageAlt}
					className="block w-full"
				/>
				{corners ? (
					<svg
						viewBox={`0 0 ${source.width} ${source.height}`}
						className="absolute inset-0 h-full w-full"
						role="presentation"
					>
						{/* The dark halo keeps the cyan line readable on bright paper, the
						    cyan keeps it readable on dark photo regions; .game-fullscreen
						    pins both tokens. */}
						<polygon
							points={polygonPoints}
							fill="none"
							stroke="var(--club-on-accent)"
							strokeWidth={source.width / 110}
							strokeLinejoin="round"
						/>
						<polygon
							points={polygonPoints}
							fill="var(--club-accent-dim)"
							stroke="var(--club-cyan)"
							strokeWidth={source.width / 250}
							strokeLinejoin="round"
						/>
						{corners.map((point, index) => {
							const handleRadius = source.width / 28;
							const focusRadius = handleRadius * 1.38;
							const xPercent =
								source.width > 0
									? Math.round((point.x / source.width) * 100)
									: 0;
							const yPercent =
								source.height > 0
									? Math.round((point.y / source.height) * 100)
									: 0;
							return (
								<g
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4 corners
									key={index}
								>
									<ellipse
										cx={point.x}
										cy={point.y}
										rx={handleRadius}
										ry={handleRadius}
										fill="none"
										stroke="var(--club-on-accent)"
										strokeWidth={source.width / 120}
										pointerEvents="none"
									/>
									<circle
										cx={point.x}
										cy={point.y}
										r={handleRadius}
										fill="var(--club-cyan)"
										fillOpacity={0.45}
										stroke="var(--club-cyan)"
										strokeWidth={source.width / 300}
										tabIndex={0}
										role="slider"
										aria-label={fmt(sudoku.scan.cornerHandle, {
											number: index + 1,
										})}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-valuenow={xPercent}
										aria-valuetext={`${xPercent}%, ${yPercent}%`}
										className="peer cursor-grab outline-none focus-visible:outline-2 focus-visible:outline-transparent"
										onKeyDown={(event) => onHandleKeyDown(index, event)}
										onPointerDown={(event) => {
											(event.target as Element).setPointerCapture?.(
												event.pointerId,
											);
											dragIndex.current = index;
										}}
									/>
									<ellipse
										cx={point.x}
										cy={point.y}
										rx={focusRadius}
										ry={focusRadius}
										fill="none"
										stroke="var(--club-on-accent)"
										strokeWidth={source.width / 90}
										pointerEvents="none"
										className="opacity-0 peer-focus-visible:opacity-100"
									/>
									<ellipse
										cx={point.x}
										cy={point.y}
										rx={focusRadius}
										ry={focusRadius}
										fill="none"
										stroke="var(--club-cyan)"
										strokeWidth={source.width / 160}
										pointerEvents="none"
										className="opacity-0 peer-focus-visible:opacity-100"
									/>
								</g>
							);
						})}
					</svg>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<p
							role="status"
							className="inline-flex items-center gap-2 rounded-full bg-slate-950/85 px-4 py-2 font-semibold text-white"
						>
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
							{sudoku.scan.findingGrid}
						</p>
					</div>
				)}
			</div>
			<div className="flex gap-3">
				<button
					type="button"
					onClick={onBack}
					className="rounded-md club-btn-outline px-4 py-2 font-semibold text-slate-300"
				>
					{messages.common.actions.back}
				</button>
				<button
					type="button"
					onClick={() => corners && onConfirm(corners)}
					disabled={!corners}
					className="club-btn-primary disabled:opacity-50"
				>
					{sudoku.scan.readGrid}
				</button>
			</div>
		</div>
	);
}

function scanCellSummary(cell: ScanCell) {
	if (cell.type === "given" || cell.type === "userDigit") {
		return String(cell.digit || "?");
	}
	if (cell.type === "empty") {
		return "";
	}
	return [
		...digitsInMask(cell.cornerMask),
		...digitsInMask(cell.centerMask),
	].join("");
}

const GRID_SIZE = 9;

/** Where an arrow key (or Home/End) moves focus in the 9x9 grid, clamped at the edges. */
function nextGridIndex(index: number, key: string): number | null {
	const row = Math.floor(index / GRID_SIZE);
	const col = index % GRID_SIZE;
	switch (key) {
		case "ArrowLeft":
			return row * GRID_SIZE + Math.max(0, col - 1);
		case "ArrowRight":
			return row * GRID_SIZE + Math.min(GRID_SIZE - 1, col + 1);
		case "ArrowUp":
			return Math.max(0, row - 1) * GRID_SIZE + col;
		case "ArrowDown":
			return Math.min(GRID_SIZE - 1, row + 1) * GRID_SIZE + col;
		case "Home":
			return row * GRID_SIZE;
		case "End":
			return row * GRID_SIZE + GRID_SIZE - 1;
		default:
			return null;
	}
}

function VerifyStep({
	warpedUrl,
	cells,
	onCellsChange,
	onRescan,
	onError,
}: {
	warpedUrl: string;
	cells: ScanCell[];
	onCellsChange: (cells: ScanCell[]) => void;
	onRescan: () => void;
	onError: (message: string) => void;
}) {
	const { locale, messages } = useI18n();
	const sudoku = messages.games.sudoku;
	const CELL_TYPES: { id: ScanCellType; label: string }[] = [
		{ id: "given", label: sudoku.scan.cellTypeGiven },
		{ id: "userDigit", label: sudoku.scan.cellTypeUserDigit },
		{ id: "cornerNotes", label: sudoku.scan.cellTypeCornerNotes },
		{ id: "centerNotes", label: sudoku.scan.cellTypeCenterNotes },
		{ id: "empty", label: sudoku.scan.cellTypeEmpty },
	];
	const create = useMutation(api.sudoku.create);
	const { busy, error, host } = useHostSession("sudoku");
	const [selected, setSelected] = useState<number | null>(null);
	// The one cell in the tab order; null until the player focuses a cell.
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const gridLabelId = useId();
	const tabStop = focusIndex ?? selected ?? 0;

	const cellName = (entry: ScanCell, index: number) => {
		let value: string = sudoku.scan.verifyCellEmpty;
		if (entry.type === "given" || entry.type === "userDigit") {
			value = entry.digit ? String(entry.digit) : sudoku.scan.verifyCellUnknown;
		} else if (entry.type === "cornerNotes" || entry.type === "centerNotes") {
			// A note cell can hold both kinds; name each kind with its own digits.
			const parts = [
				[sudoku.scan.cellTypeCornerNotes, digitsInMask(entry.cornerMask)],
				[sudoku.scan.cellTypeCenterNotes, digitsInMask(entry.centerMask)],
			] as const;
			const named = parts
				.filter(([, digits]) => digits.length > 0)
				.map(([type, digits]) =>
					fmt(sudoku.scan.verifyCellNotes, { type, digits: digits.join(" ") }),
				);
			if (named.length > 0) {
				value = named.join("; ");
			}
		}
		return fmt(sudoku.scan.verifyCellName, {
			row: Math.floor(index / GRID_SIZE) + 1,
			col: (index % GRID_SIZE) + 1,
			value,
		});
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

	useEffect(() => {
		if (error) {
			onError(error);
		}
	}, [error, onError]);

	const validation = useMemo(() => validateScanResult(cells), [cells]);
	const validationErrors = describeScanErrors(
		validation,
		sudoku.scan.validation,
		locale,
	);
	const previewBoard = useMemo(() => scanResultToBoardState(cells), [cells]);
	const conflictSet = useMemo(
		() => new Set(validation.conflictCells),
		[validation],
	);
	const lowConfidenceCount = cells.filter(isLowConfidence).length;

	useEffect(() => {
		// Preselect the first low-confidence cell to guide correction.
		const first = cells.findIndex(isLowConfidence);
		setSelected((current) =>
			current === null && first >= 0 ? first : current,
		);
	}, [cells]);

	const confirm = () =>
		host(async ({ displayName, guestId }) => {
			const title = autoSessionTitle(undefined, "scan");
			const board = scanResultToBoardState(cells);
			return createSudokuSession(create, {
				title,
				displayName,
				guestId,
				source: "scan",
				givens: digitsToString(board.givens),
				digits: digitsToString(board.digits),
				cornerNotes: board.corner,
				centerNotes: board.center,
			});
		}, sudoku.scan.couldNotCreateSession);

	const cell = selected !== null ? cells[selected] : null;

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
						{sudoku.scan.recognizedGridLabel}
					</p>
					{/* A grid of 9 rows of 9 gridcells; each gridcell wraps the one real
					    button, which keeps the per-cell name and roving tabindex. */}
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
								{cells
									.slice(row * GRID_SIZE, (row + 1) * GRID_SIZE)
									.map((entry, col) => {
										const index = row * GRID_SIZE + col;
										const borders = [
											col % 3 === 0
												? "border-l-2 border-l-slate-300/70"
												: "border-l border-l-[var(--club-line-strong)]",
											row % 3 === 0
												? "border-t-2 border-t-slate-300/70"
												: "border-t border-t-[var(--club-line-strong)]",
										].join(" ");
										const flag = conflictSet.has(index)
											? "bg-red-500/30"
											: isLowConfidence(entry)
												? "bg-amber-400/25"
												: "";
										return (
											// biome-ignore lint/a11y/useFocusableInteractive: focus lives on the button inside (roving tabindex)
											// biome-ignore lint/a11y/useSemanticElements: see the grid above
											<div
												key={index}
												role="gridcell"
												aria-selected={selected === index}
												className={`flex min-h-0 min-w-0 ${borders} ${flag}`}
											>
												<button
													ref={(node) => {
														cellRefs.current[index] = node;
													}}
													type="button"
													aria-label={cellName(entry, index)}
													tabIndex={index === tabStop ? 0 : -1}
													onClick={() => {
														setSelected(index);
														setFocusIndex(index);
													}}
													onFocus={() => setFocusIndex(index)}
													onKeyDown={(event) => onCellKeyDown(index, event)}
													className={`relative flex min-w-0 flex-1 items-center justify-center outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-[var(--club-cyan)] focus-visible:shadow-[0_0_0_4px_var(--club-on-accent)] ${
														selected === index
															? "ring-2 ring-inset ring-[var(--club-cyan)]"
															: ""
													}`}
												>
													<span
														className={`text-[clamp(0.6rem,2.6vw,1rem)] font-semibold ${
															entry.type === "given"
																? "text-slate-100"
																: entry.type === "userDigit"
																	? "text-sky-300"
																	: "text-slate-400"
														}`}
													>
														{scanCellSummary(entry)}
													</span>
												</button>
											</div>
										);
									})}
							</div>
						))}
					</div>
					<p className="mt-1 text-xs text-slate-400">
						{lowConfidenceCount > 0
							? plural(
									locale,
									lowConfidenceCount,
									sudoku.scan.lowConfidenceHighlighted,
								)
							: sudoku.scan.allConfident}
					</p>
				</div>
			</div>

			{cell !== null && selected !== null ? (
				<div className="max-w-xl rounded-lg border border-slate-600/70 bg-slate-800/60 p-4">
					<p className="mb-2 text-sm font-bold text-white">
						{fmt(sudoku.scan.cellLabel, {
							row: Math.floor(selected / 9) + 1,
							col: (selected % 9) + 1,
						})}
						{isLowConfidence(cell) ? (
							<span className="ml-2 rounded bg-amber-400/30 px-1.5 py-0.5 text-xs font-semibold text-amber-200">
								{sudoku.scan.lowConfidenceBadge}
							</span>
						) : null}
					</p>
					<div className="mb-3 flex flex-wrap gap-1.5">
						{CELL_TYPES.map((entry) => (
							<button
								key={entry.id}
								type="button"
								onClick={() =>
									onCellsChange(setScanCellType(cells, selected, entry.id))
								}
								className={`rounded-md px-2 py-1 text-xs font-bold ${
									cell.type === entry.id
										? "bg-sky-400 text-slate-950"
										: "club-btn-outline text-slate-300 hover:bg-slate-700"
								}`}
							>
								{entry.label}
							</button>
						))}
					</div>
					{cell.type === "given" || cell.type === "userDigit" ? (
						<div className="mb-2 grid grid-cols-9 gap-1">
							{Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
								<button
									key={digit}
									type="button"
									onClick={() =>
										onCellsChange(setScanCellDigit(cells, selected, digit))
									}
									className={`rounded py-1 text-sm font-bold ${
										cell.digit === digit
											? "bg-sky-400 text-slate-950"
											: "club-btn-outline text-slate-200 hover:bg-slate-700"
									}`}
								>
									{digit}
								</button>
							))}
						</div>
					) : null}
					{cell.type === "cornerNotes" || cell.type === "centerNotes" ? (
						<div className="mb-2 space-y-2">
							{(["corner", "center"] as const).map((kind) => (
								<div key={kind} className="flex items-center gap-1">
									<span className="w-14 text-xs text-slate-400">
										{kind === "corner"
											? sudoku.keypad.modes.corner
											: sudoku.keypad.modes.center}
									</span>
									{Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => {
										const mask =
											kind === "corner" ? cell.cornerMask : cell.centerMask;
										const active = digitsInMask(mask).includes(digit);
										return (
											<button
												key={digit}
												type="button"
												onClick={() =>
													onCellsChange(
														toggleScanCellNote(cells, selected, kind, digit),
													)
												}
												className={`h-6 w-6 rounded text-xs font-bold ${
													active
														? "bg-sky-400 text-slate-950"
														: "club-btn-outline text-slate-300"
												}`}
											>
												{digit}
											</button>
										);
									})}
								</div>
							))}
						</div>
					) : null}
					<button
						type="button"
						onClick={() => onCellsChange(clearScanCell(cells, selected))}
						className="rounded-md club-btn-outline px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
					>
						{sudoku.scan.clearCell}
					</button>
				</div>
			) : null}

			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
					{sudoku.scan.previewLabel}
				</p>
				<SudokuBoard
					board={previewBoard}
					selectedCell={null}
					conflicts={conflictSet}
					className="max-w-[420px]"
				/>
			</div>

			<div className="max-w-xl">
				{validationErrors.length > 0 ? (
					<ul className="mb-3 space-y-1 rounded-md border border-orange-400/40 bg-orange-500/10 px-4 py-3 club-error">
						{validationErrors.map((message) => (
							<li key={message}>{message}</li>
						))}
					</ul>
				) : !validation.givensUnique ? (
					<p className="mb-3 rounded-md border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
						{sudoku.scan.multipleSolutionsWarning}
					</p>
				) : (
					<p className="mb-3 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
						{sudoku.scan.uniqueSolution}
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
						disabled={!validation.ok || busy}
						onClick={confirm}
						className="inline-flex items-center gap-2 club-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Check className="h-4 w-4" />
						{busy ? sudoku.scan.creatingPuzzle : sudoku.scan.confirmAndPlay}
					</button>
				</div>
			</div>
		</div>
	);
}
