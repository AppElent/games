import { useMutation } from "convex/react";
import { Camera, Check, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { digitsInMask } from "#/lib/games/sudoku";
import {
	autoSessionTitle,
	rememberLocalSudokuSession,
} from "#/lib/games/sudoku-local";
import type { ScanCell, ScanCellType } from "#/lib/games/sudoku-scan";
import {
	clearScanCell,
	isLowConfidence,
	scanResultToBoardState,
	setScanCellDigit,
	setScanCellType,
	toggleScanCellNote,
	validateScanResult,
} from "#/lib/games/sudoku-scan";
import type { Point, ScanProgress } from "#/lib/games/sudoku-scan-image";
import {
	defaultCorners,
	fileToCanvas,
	recognizeGrid,
	warpToSquare,
} from "#/lib/games/sudoku-scan-image";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { SudokuBoard } from "./SudokuBoard";

type Step =
	| { id: "upload" }
	| { id: "corners"; source: HTMLCanvasElement; corners: Point[] }
	| { id: "recognizing"; warpedUrl: string; progress: ScanProgress }
	| { id: "verify"; warpedUrl: string; cells: ScanCell[] };

export function SudokuScanFlow() {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const [step, setStep] = useState<Step>({ id: "upload" });
	const [error, setError] = useState("");

	const onFile = async (file: File | undefined) => {
		if (!file) {
			return;
		}
		setError("");
		try {
			const source = await fileToCanvas(file);
			setStep({
				id: "corners",
				source,
				corners: defaultCorners(source.width, source.height),
			});
		} catch (caught) {
			setError(getUserErrorMessage(caught, sudoku.scan.couldNotReadImage));
		}
	};

	const runRecognition = async (
		source: HTMLCanvasElement,
		corners: Point[],
	) => {
		setError("");
		try {
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
		} catch (caught) {
			setError(getUserErrorMessage(caught, sudoku.scan.recognitionFailed));
			setStep({ id: "upload" });
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{error ? <p className="text-sm text-orange-200">{error}</p> : null}
			{step.id === "upload" ? <UploadStep onFile={onFile} /> : null}
			{step.id === "corners" ? (
				<CornerStep
					source={step.source}
					corners={step.corners}
					onChange={(corners) => setStep({ ...step, corners })}
					onConfirm={() => runRecognition(step.source, step.corners)}
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
					className="inline-flex items-center gap-2 rounded-md border border-slate-600/70 bg-slate-800/60 px-5 py-3 font-bold text-slate-200"
				>
					<Upload className="h-5 w-5" /> {sudoku.scan.uploadImage}
				</button>
			</div>
		</div>
	);
}

function CornerStep({
	source,
	corners,
	onChange,
	onConfirm,
	onBack,
}: {
	source: HTMLCanvasElement;
	corners: Point[];
	onChange: (corners: Point[]) => void;
	onConfirm: () => void;
	onBack: () => void;
}) {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const containerRef = useRef<HTMLDivElement>(null);
	const [imageUrl] = useState(() => source.toDataURL("image/jpeg", 0.8));
	const dragIndex = useRef<number | null>(null);

	const toSourcePoint = (event: React.PointerEvent) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) {
			return null;
		}
		const x = ((event.clientX - rect.left) / rect.width) * source.width;
		const y = ((event.clientY - rect.top) / rect.height) * source.height;
		return {
			x: Math.max(0, Math.min(source.width, x)),
			y: Math.max(0, Math.min(source.height, y)),
		};
	};

	return (
		<div className="flex max-w-xl flex-col gap-3">
			<p className="text-slate-300">{sudoku.scan.dragCorners}</p>
			<div
				ref={containerRef}
				className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-slate-600"
				onPointerMove={(event) => {
					if (dragIndex.current === null) {
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
				<svg
					viewBox={`0 0 ${source.width} ${source.height}`}
					className="absolute inset-0 h-full w-full"
					role="presentation"
				>
					<polygon
						points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
						fill="rgba(56,189,248,0.12)"
						stroke="#38bdf8"
						strokeWidth={source.width / 250}
					/>
					{corners.map((point, index) => (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4 corners
							key={index}
							cx={point.x}
							cy={point.y}
							r={source.width / 28}
							fill="rgba(56,189,248,0.5)"
							stroke="#e0f2fe"
							strokeWidth={source.width / 300}
							style={{ cursor: "grab" }}
							onPointerDown={(event) => {
								(event.target as Element).setPointerCapture?.(event.pointerId);
								dragIndex.current = index;
							}}
						/>
					))}
				</svg>
			</div>
			<div className="flex gap-3">
				<button
					type="button"
					onClick={onBack}
					className="rounded-md border border-slate-600/70 px-4 py-2 font-semibold text-slate-300"
				>
					{messages.common.actions.back}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="rounded-md bg-white px-5 py-2 font-bold text-slate-950"
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
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.sudoku.createState);
	const [selected, setSelected] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);

	const validation = useMemo(() => validateScanResult(cells), [cells]);
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

	const confirm = async () => {
		setBusy(true);
		try {
			const guest = getOrCreateGuestIdentity();
			const title = autoSessionTitle(undefined, "scan");
			const board = scanResultToBoardState(cells);
			const result = await createSession({
				gameType: "sudoku",
				joinMode: "solo",
				authPolicy: "guestAllowed",
				title,
				displayName: guest.displayName,
				guestId: guest.id,
			});
			await createState({
				sessionId: result.sessionId,
				source: "scan",
				givens: board.givens.join(""),
				digits: board.digits.join(""),
				cornerNotes: board.corner,
				centerNotes: board.center,
			});
			rememberLocalSudokuSession({
				sessionId: result.sessionId,
				title,
				source: "scan",
				createdAt: Date.now(),
			});
			window.location.href = `/sudoku/${result.sessionId}`;
		} catch (caught) {
			onError(getUserErrorMessage(caught, sudoku.scan.couldNotCreateSession));
			setBusy(false);
		}
	};

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
					<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
						{sudoku.scan.recognizedGridLabel}
					</p>
					<div className="grid aspect-square w-full max-w-[420px] grid-cols-9 grid-rows-9 rounded-md border-2 border-slate-400/70 bg-slate-900">
						{cells.map((entry, index) => {
							const row = Math.floor(index / 9);
							const col = index % 9;
							const borders = [
								col % 3 === 0
									? "border-l-2 border-l-slate-400/60"
									: "border-l border-l-slate-600/50",
								row % 3 === 0
									? "border-t-2 border-t-slate-400/60"
									: "border-t border-t-slate-600/50",
							].join(" ");
							const flag = conflictSet.has(index)
								? "bg-red-500/30"
								: isLowConfidence(entry)
									? "bg-amber-400/25"
									: "";
							return (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed 81-cell grid
									key={index}
									type="button"
									onClick={() => setSelected(index)}
									className={`relative flex items-center justify-center ${borders} ${flag} ${
										selected === index ? "ring-2 ring-inset ring-sky-300" : ""
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
							);
						})}
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
										: "border border-slate-600 text-slate-300 hover:bg-slate-700"
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
											: "border border-slate-600 text-slate-200 hover:bg-slate-700"
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
											? sudoku.keypad.modeCorner
											: sudoku.keypad.modeCenter}
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
														: "border border-slate-600 text-slate-300"
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
						className="rounded-md border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
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
				{validation.errors.length > 0 ? (
					<ul className="mb-3 space-y-1 rounded-md border border-orange-400/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
						{validation.errors.map((message) => (
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
						className="rounded-md border border-slate-600/70 px-4 py-2 font-semibold text-slate-300"
					>
						{sudoku.scan.startOver}
					</button>
					<button
						type="button"
						disabled={!validation.ok || busy}
						onClick={confirm}
						className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Check className="h-4 w-4" />
						{busy ? sudoku.scan.creatingPuzzle : sudoku.scan.confirmAndPlay}
					</button>
				</div>
			</div>
		</div>
	);
}
