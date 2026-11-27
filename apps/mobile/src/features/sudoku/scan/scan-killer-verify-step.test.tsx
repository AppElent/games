import { mulberry32 } from "@arcadeclub/core/random";
import {
	edgeBetween,
	edgeKey,
	type KillerScan,
	killerScanCages,
} from "@arcadeclub/core/sudoku-scan-cages";
import { generateVariantPuzzle } from "@arcadeclub/core/sudoku-variants";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { readSudokuSave, writeSudokuSave } from "../saves/sudoku-save-store";
import { createKillerScanSave } from "./create-scan-save";
import { ScanKillerVerifyStep } from "./scan-killer-verify-step";

/** A generated Killer as a scan reads it: every cage line and sum found. */
function scannedKiller(): KillerScan {
	const puzzle = generateVariantPuzzle("killer", "easy", mulberry32(3));
	if (puzzle.variant !== "killer") throw new Error("not a Killer");
	const cageOf = new Array<number>(81).fill(-1);
	puzzle.cages.forEach((cage, index) => {
		for (const cell of cage.cells) cageOf[cell] = index;
	});
	const borders: string[] = [];
	for (let cell = 0; cell < 81; cell += 1) {
		for (const other of [cell % 9 < 8 ? cell + 1 : -1, cell + 9]) {
			const edge = other >= 0 && other < 81 ? edgeBetween(cell, other) : null;
			if (edge && cageOf[cell] !== cageOf[other]) borders.push(edgeKey(edge));
		}
	}
	const sums: Record<number, number> = {};
	for (const cage of puzzle.cages) sums[Math.min(...cage.cells)] = cage.sum;
	return { borders, doubtful: [], sums };
}

async function setup(scan: KillerScan) {
	const handlers = {
		onChange: jest.fn(),
		onStartOver: jest.fn(),
		onReadAsClassic: jest.fn(),
		onConfirm: jest.fn(),
	};
	const view = await renderScreen(
		<ScanKillerVerifyStep
			gridUri="file://grid.png"
			scan={scan}
			error={null}
			{...handlers}
		/>,
	);
	return { ...handlers, view };
}

describe("ScanKillerVerifyStep", () => {
	const complete = scannedKiller();
	const first = killerScanCages(complete)[0];

	it("plays a Killer whose cages and sums check out", async () => {
		const { onConfirm } = await setup(complete);
		expect(screen.getByText("Cages and sums add up to 405.")).toBeTruthy();
		// Two quick taps: the solution count runs once, then play starts once.
		const button = screen.getByTestId("killer-confirm");
		await act(async () => {
			fireEvent.press(button);
			fireEvent.press(button);
		});
		await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
	});

	it("starts on a cage without a sum, and takes the sum typed in", async () => {
		const missing = { ...complete, sums: { ...complete.sums } };
		delete missing.sums[first.cells[0]];
		const { onChange, onConfirm } = await setup(missing);
		expect(screen.getByText("1 cage has no sum yet.")).toBeTruthy();
		expect(
			screen.getByTestId(`killer-cell-${first.cells[0]}`).props
				.accessibilityState,
		).toMatchObject({ selected: true });
		await act(async () =>
			fireEvent.press(screen.getByTestId("killer-confirm")),
		);
		expect(onConfirm).not.toHaveBeenCalled();

		await act(async () =>
			fireEvent.changeText(screen.getByTestId("killer-sum"), String(first.sum)),
		);
		expect(onChange).toHaveBeenLastCalledWith(complete);
	});

	it("names each cell with its cage and sum", async () => {
		await setup(complete);
		const cell = first.cells[0];
		expect(
			screen.getByLabelText(
				`Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}: cage of ${first.cells.length}, sum ${first.sum}`,
			),
		).toBeTruthy();
	});

	it("draws or removes the line beside the picked cell", async () => {
		const unsure = {
			...complete,
			doubtful: [complete.borders[0]],
		};
		const { onChange } = await setup(unsure);
		expect(
			screen.getByText(
				"1 unsure cage line is marked in amber. Compare it with the photo.",
			),
		).toBeTruthy();
		const cell = Number.parseInt(complete.borders[0], 10);
		await act(async () =>
			fireEvent.press(screen.getByTestId(`killer-cell-${cell}`)),
		);
		const direction = complete.borders[0].endsWith("r") ? "right" : "down";
		const line = screen.getByTestId(`killer-line-${direction}`);
		expect(line.props.accessibilityState).toMatchObject({ checked: true });
		expect(screen.getAllByText("unsure").length).toBeGreaterThan(0);
		await act(async () => fireEvent.press(line));
		const next: KillerScan = onChange.mock.calls[0][0];
		expect(next.borders).not.toContain(complete.borders[0]);
	});

	it("blocks a scan whose sums do not add up to 405", async () => {
		const off = {
			...complete,
			sums: {
				...complete.sums,
				[first.cells[0]]: first.sum === 45 ? 44 : first.sum + 1,
			},
		};
		const { onConfirm } = await setup(off);
		expect(
			screen.getByText(
				"The sums add up to 406; a Killer's sums add up to 405.",
			),
		).toBeTruthy();
		await act(async () =>
			fireEvent.press(screen.getByTestId("killer-confirm")),
		);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("reads the photo as a classic grid on request", async () => {
		const { onReadAsClassic } = await setup(complete);
		await act(async () =>
			fireEvent.press(screen.getByTestId("killer-read-as-classic")),
		);
		expect(onReadAsClassic).toHaveBeenCalled();
	});
});

describe("createKillerScanSave", () => {
	it("stores the cages and sums as a Killer to play", () => {
		const scan = scannedKiller();
		const save = createKillerScanSave(scan, "user_me", 1000);
		expect(save).toMatchObject({
			source: "scan",
			variant: "killer",
			updatedAt: 1000,
			cloud: { userId: "user_me", synced: false },
		});
		expect(save.solution).toBeUndefined();
		expect(save.board.givens).toBe("0".repeat(81));
		expect(save.cages).toEqual(
			killerScanCages(scan).map((cage) => ({
				cells: cage.cells,
				sum: cage.sum,
			})),
		);
		writeSudokuSave(save);
		expect(readSudokuSave(save.id)).toMatchObject({ variant: "killer" });
	});
});
