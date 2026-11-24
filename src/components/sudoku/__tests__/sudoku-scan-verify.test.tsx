// @vitest-environment jsdom
import { emptyScanCell, type ScanCell } from "@arcadeclub/core/sudoku-scan";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Locale, LocaleProvider } from "#/lib/i18n";
import { SudokuScanFlow } from "../SudokuScanFlow";

const { findGridCorners, recognizeGrid } = vi.hoisted(() => ({
	findGridCorners: vi.fn(),
	recognizeGrid: vi.fn(),
}));
vi.mock("#/lib/games/sudoku-grid-finder", () => ({ findGridCorners }));
vi.mock("#/lib/games/sudoku-scan-image", () => ({
	fileToCanvas: async () =>
		Object.assign(document.createElement("canvas"), {
			width: 1000,
			height: 800,
		}),
	recognizeGrid,
	warpToSquare: () => document.createElement("canvas"),
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("#/lib/games/use-host-session", () => ({
	useHostSession: () => ({ busy: false, error: "", host: vi.fn() }),
}));

const given = (digit: number): ScanCell => ({
	type: "given",
	digit,
	cornerMask: 0,
	centerMask: 0,
	confidence: 1,
});

/** Row 1: a 5, corner notes 1+3, then an unreadable low-confidence given (preselected). */
function scannedCells(): ScanCell[] {
	const cells = Array.from({ length: 81 }, () => emptyScanCell());
	cells[0] = given(5);
	cells[1] = {
		type: "cornerNotes",
		digit: 0,
		cornerMask: 0b101,
		centerMask: 0,
		confidence: 1,
	};
	cells[2] = { ...given(0), confidence: 0.3 };
	return cells;
}

async function openVerifyStep(locale: Locale = "en") {
	findGridCorners.mockResolvedValue(null);
	recognizeGrid.mockResolvedValue(scannedCells());
	const { container } = render(
		<LocaleProvider initialLocale={locale}>
			<SudokuScanFlow />
		</LocaleProvider>,
	);
	const input = container.querySelector('input[type="file"]');
	if (!input) {
		throw new Error("no photo input");
	}
	fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg")] } });
	await waitFor(() => expect(screen.getAllByRole("slider")).toHaveLength(4));
	fireEvent.click(
		screen.getByRole("button", {
			name: locale === "en" ? "Read this grid" : "Lees dit raster",
		}),
	);
	// Cells are named "Row r, column c: …" / "Rij r, kolom c: …".
	await waitFor(() =>
		expect(
			container.querySelectorAll("button[aria-label*=', ']").length,
		).toBeGreaterThanOrEqual(81),
	);
	return container;
}

const cellAt = (row: number, col: number, locale: Locale = "en") =>
	screen.getByRole("button", {
		name: new RegExp(
			locale === "en"
				? `^Row ${row}, column ${col}:`
				: `^Rij ${row}, kolom ${col}:`,
		),
	}) as HTMLButtonElement;

describe("the scan's corner instruction", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
			"data:image/jpeg;base64,",
		);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it.each([
		["en", /arrow keys.*Shift/i],
		["nl", /pijltjestoetsen.*Shift/i],
	] as const)("mentions the keyboard in %s", async (locale, pattern) => {
		findGridCorners.mockResolvedValue(null);
		const { container } = render(
			<LocaleProvider initialLocale={locale}>
				<SudokuScanFlow />
			</LocaleProvider>,
		);
		const input = container.querySelector('input[type="file"]');
		if (!input) {
			throw new Error("no photo input");
		}
		fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg")] } });
		await waitFor(() => expect(screen.getAllByRole("slider")).toHaveLength(4));
		const instruction = container.querySelector("p.text-slate-300");
		expect(instruction?.textContent).toMatch(pattern);
	});
});

describe("the verify step's recognised grid", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
			"data:image/jpeg;base64,",
		);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("names each cell with its row, column and value in English", async () => {
		await openVerifyStep("en");
		expect(cellAt(1, 1).getAttribute("aria-label")).toBe("Row 1, column 1: 5");
		expect(cellAt(1, 2).getAttribute("aria-label")).toBe(
			"Row 1, column 2: Corner notes 1 3",
		);
		expect(cellAt(1, 3).getAttribute("aria-label")).toBe(
			"Row 1, column 3: unreadable digit",
		);
		expect(cellAt(9, 9).getAttribute("aria-label")).toBe(
			"Row 9, column 9: empty",
		);
	});

	it("names each cell in Dutch", async () => {
		await openVerifyStep("nl");
		expect(cellAt(1, 1, "nl").getAttribute("aria-label")).toBe(
			"Rij 1, kolom 1: 5",
		);
		expect(cellAt(1, 2, "nl").getAttribute("aria-label")).toBe(
			"Rij 1, kolom 2: Hoeknotities 1 3",
		);
		expect(cellAt(9, 9, "nl").getAttribute("aria-label")).toBe(
			"Rij 9, kolom 9: leeg",
		);
	});

	it("keeps exactly one cell in the tab order", async () => {
		const container = await openVerifyStep();
		const cells = [
			...container.querySelectorAll<HTMLButtonElement>("button[aria-label]"),
		].filter((el) => /^Row \d, column \d:/.test(el.ariaLabel ?? ""));
		expect(cells).toHaveLength(81);
		// The first low-confidence cell is preselected once the effect has run.
		await waitFor(() =>
			expect(cells.filter((el) => el.tabIndex === 0)).toEqual([cellAt(1, 3)]),
		);
	});

	it("moves focus with the arrow keys, clamped at the edges", async () => {
		await openVerifyStep();
		const start = cellAt(5, 5);
		start.focus();

		fireEvent.keyDown(start, { key: "ArrowRight" });
		expect(document.activeElement).toBe(cellAt(5, 6));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
		expect(document.activeElement).toBe(cellAt(6, 6));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
		expect(document.activeElement).toBe(cellAt(5, 5));

		const first = cellAt(1, 1);
		first.focus();
		fireEvent.keyDown(first, { key: "ArrowLeft" });
		fireEvent.keyDown(first, { key: "ArrowUp" });
		expect(document.activeElement).toBe(first);

		const last = cellAt(9, 9);
		last.focus();
		fireEvent.keyDown(last, { key: "ArrowRight" });
		fireEvent.keyDown(last, { key: "ArrowDown" });
		expect(document.activeElement).toBe(last);

		fireEvent.keyDown(last, { key: "Home" });
		expect(document.activeElement).toBe(cellAt(9, 1));
		fireEvent.keyDown(document.activeElement as Element, { key: "End" });
		expect(document.activeElement).toBe(cellAt(9, 9));
	});

	it("moves the tab stop with focus and still selects a cell on click", async () => {
		await openVerifyStep();
		const target = cellAt(4, 7);
		fireEvent.click(target);
		expect(target.tabIndex).toBe(0);
		expect(cellAt(1, 3).tabIndex).toBe(-1);
		expect(screen.getByText("Cell R4C7")).toBeTruthy();

		fireEvent.keyDown(target, { key: "ArrowDown" });
		expect(cellAt(5, 7).tabIndex).toBe(0);
		expect(target.tabIndex).toBe(-1);
	});
});
