/**
 * The scan flow's steps, as on the web's `/sudoku/scan`: pick a photo, place
 * the grid's corners (prefilled from detection), read the cells, then check
 * and correct the recognized grid. Apple Vision reads the digits on the
 * phone; which ink to read and what it makes of a cell is shared with the
 * web in `@arcadeclub/core/sudoku-scan-ink`.
 */
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import {
	type DigitRead,
	defaultCorners,
	gridReadBoxes,
	type Point,
	planGridReads,
	scanCellsFromGridReads,
} from "@arcadeclub/core/sudoku-scan-ink";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import {
	type PreparedPhoto,
	sudokuScanner,
} from "../../../../modules/sudoku-scanner";
import type { Messages } from "../../../i18n";
import { reportError } from "../../../observability/report";

export type ScanStep =
	| { id: "pick" }
	| { id: "preparing" }
	| { id: "corners"; photo: PreparedPhoto; corners: Point[] }
	| { id: "reading"; gridUri: string | null; done: number }
	| { id: "verify"; gridUri: string; cells: ScanCell[] };

export type PhotoSource = "camera" | "library";

const CELLS_PER_ROW = 9;

export function useSudokuScan(copy: Messages["games"]["sudoku"]["scan"]) {
	const [step, setStep] = useState<ScanStep>({ id: "pick" });
	const [error, setError] = useState<string | null>(null);
	const [cameraBlocked, setCameraBlocked] = useState(false);
	// A newer scan makes an older one's answers stale.
	const run = useRef(0);

	async function pick(source: PhotoSource) {
		const scanner = sudokuScanner;
		if (!scanner) return;
		setError(null);
		setCameraBlocked(false);
		if (source === "camera") {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				setError(copy.cameraDenied);
				setCameraBlocked(!permission.canAskAgain);
				return;
			}
		}
		const options: ImagePicker.ImagePickerOptions = {
			mediaTypes: ["images"],
			quality: 1,
		};
		const result =
			source === "camera"
				? await ImagePicker.launchCameraAsync(options)
				: await ImagePicker.launchImageLibraryAsync(options);
		const asset = result.canceled ? undefined : result.assets[0];
		if (!asset) return;

		const current = ++run.current;
		setStep({ id: "preparing" });
		try {
			const photo = await scanner.prepareImage(asset.uri);
			const detected = await scanner.detectGrid(photo.uri);
			if (current !== run.current) return;
			setStep({
				id: "corners",
				photo,
				corners: detected ?? defaultCorners(photo.width, photo.height),
			});
		} catch (cause) {
			if (current !== run.current) return;
			reportError(cause);
			setError(copy.couldNotReadImage);
			setStep({ id: "pick" });
		}
	}

	function moveCorners(corners: Point[]) {
		setStep((current) =>
			current.id === "corners" ? { ...current, corners } : current,
		);
	}

	async function read() {
		const scanner = sudokuScanner;
		if (!scanner || step.id !== "corners") return;
		const back = step;
		const current = ++run.current;
		setError(null);
		setStep({ id: "reading", gridUri: null, done: 0 });
		try {
			const grid = await scanner.warpGrid(back.photo.uri, back.corners);
			const plans = planGridReads(grid.pixels, grid.size);
			const reads: DigitRead[] = [];
			// A row at a time, so the screen can count the cells read.
			for (let row = 0; row < 9; row += 1) {
				if (current !== run.current) return;
				setStep({
					id: "reading",
					gridUri: grid.uri,
					done: row * CELLS_PER_ROW,
				});
				const rowPlans = plans.slice(
					row * CELLS_PER_ROW,
					(row + 1) * CELLS_PER_ROW,
				);
				const boxes = gridReadBoxes(rowPlans);
				const rowReads =
					boxes.length > 0 ? await scanner.readDigits(grid.uri, boxes) : [];
				if (rowReads.length !== boxes.length) {
					throw new Error(
						"The reader answered for a different number of boxes",
					);
				}
				reads.push(...rowReads);
			}
			if (current !== run.current) return;
			setStep({
				id: "verify",
				gridUri: grid.uri,
				cells: scanCellsFromGridReads(plans, reads),
			});
		} catch (cause) {
			if (current !== run.current) return;
			reportError(cause);
			setError(copy.recognitionFailed);
			setStep(back);
		}
	}

	function editCells(cells: ScanCell[]) {
		setStep((current) =>
			current.id === "verify" ? { ...current, cells } : current,
		);
	}

	function startOver() {
		run.current += 1;
		setError(null);
		setStep({ id: "pick" });
	}

	return {
		step,
		error,
		cameraBlocked,
		pick,
		moveCorners,
		read,
		editCells,
		startOver,
	};
}
