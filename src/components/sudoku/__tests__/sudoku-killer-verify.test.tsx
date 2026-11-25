// @vitest-environment jsdom
import type { KillerScan } from "@arcadeclub/core/sudoku-scan-cages";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { KillerVerifyStep } from "../SudokuKillerVerifyStep";

const host = vi.fn();
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("#/lib/games/use-host-session", () => ({
	useHostSession: () => ({ busy: false, error: "", host }),
}));

/** Nine row cages, each summing to 45; `missing` rows have no sum yet. */
function rowScan(missing: number[] = []): KillerScan {
	const sums: Record<number, number> = {};
	for (let row = 0; row < 9; row += 1) {
		if (!missing.includes(row)) {
			sums[row * 9] = 45;
		}
	}
	return {
		borders: Array.from({ length: 72 }, (_, cell) => `${cell}b`),
		doubtful: ["9b"],
		sums,
	};
}

function Harness({ initial }: { initial: KillerScan }) {
	const [scan, setScan] = useState(initial);
	return (
		<LocaleProvider initialLocale="en">
			<KillerVerifyStep
				warpedUrl="data:image/jpeg;base64,"
				scan={scan}
				onScanChange={setScan}
				onRescan={() => {}}
				onError={() => {}}
			/>
		</LocaleProvider>
	);
}

const confirmButton = () =>
	screen.getByRole("button", { name: /Confirm and play/ }) as HTMLButtonElement;

describe("the Killer verify step", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("names each cell with its cage and sum", () => {
		render(<Harness initial={rowScan()} />);
		expect(screen.getAllByRole("gridcell")).toHaveLength(81);
		expect(
			screen.getByRole("button", {
				name: "Row 2, column 5: cage of 9, sum 45",
			}),
		).toBeTruthy();
		expect(screen.getByText(/1 unsure cage line/)).toBeTruthy();
	});

	it("lets the player play once every sum is in and they add up to 405", () => {
		render(<Harness initial={rowScan()} />);
		expect(screen.getByText("Cages and sums add up to 405.")).toBeTruthy();
		expect(confirmButton().disabled).toBe(false);
		fireEvent.click(confirmButton());
		expect(host).toHaveBeenCalledTimes(1);
	});

	it("starts on a cage without a sum and takes the typed sum", () => {
		render(<Harness initial={rowScan([3])} />);
		expect(screen.getByText("1 cage has no sum yet.")).toBeTruthy();
		expect(confirmButton().disabled).toBe(true);
		expect(screen.getByText("Cell R4C1")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Sum"), {
			target: { value: "45" },
		});
		expect(screen.getByText("Cages and sums add up to 405.")).toBeTruthy();
		expect(confirmButton().disabled).toBe(false);
	});

	it("joins two cages when a line between them is removed", () => {
		render(<Harness initial={rowScan()} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Row 1, column 1: cage of 9, sum 45",
			}),
		);
		const below = screen.getByRole("button", { name: "Line below" });
		expect(below.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(below);
		expect(
			screen.getByRole("button", {
				name: "Row 2, column 1: cage of 18, sum 45",
			}),
		).toBeTruthy();
		expect(screen.getByText(/more than 9 cells/)).toBeTruthy();
		expect(confirmButton().disabled).toBe(true);
	});
});
