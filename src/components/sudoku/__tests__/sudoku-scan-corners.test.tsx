// @vitest-environment jsdom
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import { defaultCorners } from "@arcadeclub/core/sudoku-scan-ink";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { SudokuScanFlow } from "../SudokuScanFlow";

const { findGridCorners, warpToSquare } = vi.hoisted(() => ({
	findGridCorners: vi.fn(),
	warpToSquare: vi.fn(),
}));
vi.mock("#/lib/games/sudoku-grid-finder", () => ({ findGridCorners }));
vi.mock("#/lib/games/sudoku-scan-image", () => ({
	fileToCanvas: async () =>
		Object.assign(document.createElement("canvas"), {
			width: 1000,
			height: 800,
		}),
	recognizeGrid: () => new Promise(() => {}),
	warpToSquare,
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("#/lib/games/use-host-session", () => ({
	useHostSession: () => ({ busy: false, error: "", host: vi.fn() }),
}));

const GRID: Point[] = [
	{ x: 210, y: 120 },
	{ x: 640, y: 130 },
	{ x: 650, y: 560 },
	{ x: 200, y: 550 },
];

function choosePhoto() {
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
	return container;
}

const handles = (container: HTMLElement) =>
	[...container.querySelectorAll("circle")].map((circle) => ({
		x: Number(circle.getAttribute("cx")),
		y: Number(circle.getAttribute("cy")),
	}));

const readGrid = () =>
	screen.getByRole("button", { name: "Read this grid" }) as HTMLButtonElement;

describe("the scan's corner handles", () => {
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

	it("start on the grid that was found, after saying it is looking", async () => {
		let found: (corners: Point[]) => void = () => {};
		findGridCorners.mockReturnValue(
			new Promise((resolve) => {
				found = resolve;
			}),
		);
		const container = choosePhoto();
		expect((await screen.findByRole("status")).textContent).toContain(
			"Finding the grid",
		);
		expect(handles(container)).toEqual([]);
		expect(readGrid().disabled).toBe(true);

		await act(async () => found(GRID));
		expect(screen.queryByRole("status")).toBeNull();
		expect(handles(container)).toEqual(GRID);

		warpToSquare.mockReturnValue(document.createElement("canvas"));
		fireEvent.click(readGrid());
		await waitFor(() =>
			expect(warpToSquare).toHaveBeenCalledWith(expect.anything(), GRID),
		);
	});

	it("start on the default corners, without an error, when no grid is found", async () => {
		findGridCorners.mockResolvedValue(null);
		const container = choosePhoto();
		await waitFor(() =>
			expect(handles(container)).toEqual(defaultCorners(1000, 800)),
		);
		expect(container.querySelector(".club-error")).toBeNull();
		expect(readGrid().disabled).toBe(false);
	});

	it("can still be dragged once placed", async () => {
		findGridCorners.mockResolvedValue(GRID);
		const container = choosePhoto();
		await waitFor(() => expect(handles(container)).toEqual(GRID));
		const circle = container.querySelectorAll("circle")[2];
		const photo = circle.closest("div");
		if (!photo) {
			throw new Error("no photo");
		}
		vi.spyOn(photo, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 500,
			height: 400,
		} as DOMRect);
		fireEvent.pointerDown(circle, { pointerId: 1 });
		fireEvent.pointerMove(photo, { clientX: 350, clientY: 300 });
		expect(handles(container)).toEqual([
			GRID[0],
			GRID[1],
			{ x: 700, y: 600 },
			GRID[3],
		]);
	});

	it("drop a late answer when the player has gone back", async () => {
		let found: (corners: Point[]) => void = () => {};
		findGridCorners.mockReturnValue(
			new Promise((resolve) => {
				found = resolve;
			}),
		);
		choosePhoto();
		fireEvent.click(await screen.findByRole("button", { name: "Back" }));
		const signal: AbortSignal = findGridCorners.mock.calls[0][1];
		expect(signal.aborted).toBe(true);
		await act(async () => found(GRID));
		expect(screen.getByText("Take a photo")).toBeTruthy();
	});
});
