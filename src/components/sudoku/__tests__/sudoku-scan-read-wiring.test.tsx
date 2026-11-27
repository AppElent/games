// @vitest-environment jsdom
import { emptyScanCell } from "@arcadeclub/core/sudoku-scan";
import type { CageRead } from "@arcadeclub/core/sudoku-scan-cages";
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { SudokuScanFlow } from "../SudokuScanFlow";

const {
	fileToCanvas,
	findGridCorners,
	recognizeGrid,
	readWarpedCages,
	readCageSums,
} = vi.hoisted(() => ({
	fileToCanvas: vi.fn(),
	findGridCorners: vi.fn(),
	recognizeGrid: vi.fn(),
	readWarpedCages: vi.fn(),
	readCageSums: vi.fn(),
}));
vi.mock("#/lib/games/sudoku-grid-finder", () => ({ findGridCorners }));
vi.mock("#/lib/games/sudoku-scan-image", () => ({
	fileToCanvas,
	recognizeGrid,
	readWarpedCages,
	readCageSums,
	uprightCorners: async (_source: unknown, corners: Point[]) => corners,
	parseCageSum: (text: string) => (text ? Number(text) : null),
	warpToSquare: () => document.createElement("canvas"),
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("#/lib/games/use-host-session", () => ({
	useHostSession: () => ({ busy: false, error: "", host: vi.fn() }),
}));

/** The grid the finder places the handles on. */
const FOUND: Point[] = [
	{ x: 210, y: 120 },
	{ x: 640, y: 130 },
	{ x: 650, y: 560 },
	{ x: 200, y: 550 },
];
/** The corners after the player moves the third handle 5 px right and down. */
const CONFIRMED: Point[] = [FOUND[0], FOUND[1], { x: 655, y: 565 }, FOUND[3]];

/** A Killer's cages: each row cut into three cages of three cells. */
const killerRead: CageRead = {
	cages: Array.from({ length: 27 }, (_, cage) =>
		[0, 1, 2].map((offset) => cage * 3 + offset),
	),
	borders: [],
	doubtful: [],
	bounds: { left: 0, right: 899, top: 0, bottom: 899 },
};

/** A classic grid: no dashes, so one cage holds every cell. */
const classicRead: CageRead = {
	cages: [Array.from({ length: 81 }, (_, cell) => cell)],
	borders: [],
	doubtful: [],
	bounds: { left: 0, right: 899, top: 0, bottom: 899 },
};

let photo: HTMLCanvasElement;

/** Chooses a photo, waits for the found grid and moves one corner. */
async function confirmCorners() {
	const { container } = render(
		<LocaleProvider initialLocale="en">
			<SudokuScanFlow />
		</LocaleProvider>,
	);
	const input = container.querySelector('input[type="file"]');
	if (!input) {
		throw new Error("no photo input");
	}
	fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg")] } });
	await waitFor(() => expect(screen.getAllByRole("slider")).toHaveLength(4));
	const third = screen.getAllByRole("slider")[2];
	fireEvent.keyDown(third, { key: "ArrowRight" });
	fireEvent.keyDown(third, { key: "ArrowDown" });
	fireEvent.click(screen.getByRole("button", { name: "Read this grid" }));
}

const verifyGrid = () =>
	screen.findByRole("grid", {
		name: "Recognized grid — tap a cell to correct it",
	});

describe("the scan hands recognizeGrid the photo and the confirmed corners", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
			"data:image/jpeg;base64,",
		);
		photo = Object.assign(document.createElement("canvas"), {
			width: 1000,
			height: 800,
		});
		fileToCanvas.mockResolvedValue(photo);
		findGridCorners.mockResolvedValue(FOUND);
		recognizeGrid.mockResolvedValue(
			Array.from({ length: 81 }, () => emptyScanCell()),
		);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("when it reads a classic grid directly", async () => {
		readWarpedCages.mockReturnValue(classicRead);
		await confirmCorners();
		await verifyGrid();
		expect(recognizeGrid).toHaveBeenCalledTimes(1);
		expect(recognizeGrid).toHaveBeenCalledWith(
			photo,
			CONFIRMED,
			expect.any(Function),
		);
		expect(readCageSums).not.toHaveBeenCalled();
	});

	it("when the player reads a Killer as classic from its check step", async () => {
		readWarpedCages.mockReturnValue(killerRead);
		readCageSums.mockResolvedValue(killerRead.cages.map(() => 15));
		await confirmCorners();
		const asClassic = await screen.findByRole("button", {
			name: /Read it as a classic sudoku/,
		});
		expect(recognizeGrid).not.toHaveBeenCalled();

		fireEvent.click(asClassic);
		await verifyGrid();
		expect(recognizeGrid).toHaveBeenCalledTimes(1);
		expect(recognizeGrid).toHaveBeenCalledWith(
			photo,
			CONFIRMED,
			expect.any(Function),
		);
	});
});
