import { describe, expect, it } from "vitest";
import { digitMask } from "../sudoku";
import type { SudokuInputMode } from "../sudoku-board";
import {
	cornerNoteGroups,
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	isModeCycleTap,
	nextTapMode,
	normalizeSudokuInputSettings,
	RETAP_GRACE_MS,
	type SudokuInputSettings,
	tapCycleModes,
} from "../sudoku-input";

function withCycle(
	tapCycle: Partial<SudokuInputSettings["tapCycle"]>,
): SudokuInputSettings {
	return {
		...DEFAULT_SUDOKU_INPUT_SETTINGS,
		tapCycle: { ...DEFAULT_SUDOKU_INPUT_SETTINGS.tapCycle, ...tapCycle },
	};
}

/** The modes `taps` second taps visit, starting from digit. */
function walk(settings: SudokuInputSettings, taps: number) {
	const seen: SudokuInputMode[] = [];
	let mode: SudokuInputMode = "digit";
	for (let tap = 0; tap < taps; tap += 1) {
		mode = nextTapMode(mode, settings);
		seen.push(mode);
	}
	return seen;
}

function maskOf(...digits: number[]) {
	return digits.reduce((mask, digit) => mask | digitMask(digit), 0);
}

describe("tap cycle", () => {
	it("steps through every mode and wraps by default", () => {
		expect(walk(DEFAULT_SUDOKU_INPUT_SETTINGS, 5)).toEqual([
			"corner",
			"center",
			"color",
			"digit",
			"corner",
		]);
	});

	it("skips a mode that is switched off", () => {
		const settings = withCycle({ color: false });
		expect(tapCycleModes(settings)).toEqual(["digit", "corner", "center"]);
		expect(walk(settings, 4)).toEqual(["corner", "center", "digit", "corner"]);
	});

	it("skips a switched-off mode in the middle", () => {
		expect(walk(withCycle({ corner: false }), 3)).toEqual([
			"center",
			"color",
			"digit",
		]);
	});

	it("toggles between digit and the one remaining mode", () => {
		expect(walk(withCycle({ corner: false, color: false }), 3)).toEqual([
			"center",
			"digit",
			"center",
		]);
	});

	it("does nothing when only digit remains", () => {
		const settings = withCycle({ corner: false, center: false, color: false });
		expect(tapCycleModes(settings)).toEqual(["digit"]);
		expect(nextTapMode("digit", settings)).toBe("digit");
	});

	it("moves on from a toolbar mode that is out of the cycle", () => {
		expect(nextTapMode("color", withCycle({ color: false }))).toBe("digit");
		expect(nextTapMode("corner", withCycle({ corner: false }))).toBe("center");
		expect(
			nextTapMode(
				"center",
				withCycle({ corner: false, center: false, color: false }),
			),
		).toBe("digit");
	});
});

describe("normalizeSudokuInputSettings", () => {
	it("returns the defaults for nothing or garbage", () => {
		for (const value of [null, undefined, "spread", 3, [], { tapCycle: [] }]) {
			expect(normalizeSudokuInputSettings(value)).toEqual(
				DEFAULT_SUDOKU_INPUT_SETTINGS,
			);
		}
	});

	it("keeps valid fields and defaults the rest", () => {
		expect(
			normalizeSudokuInputSettings({
				tapCycle: { color: false, center: "no", digit: false },
				cornerLayout: "topRight",
			}),
		).toEqual({
			tapCycle: { corner: true, center: true, color: false },
			cornerLayout: "topRight",
		});
	});

	it("drops an unknown corner layout and unknown fields", () => {
		expect(
			normalizeSudokuInputSettings({
				cornerLayout: "everywhere",
				extra: 1,
			}),
		).toEqual(DEFAULT_SUDOKU_INPUT_SETTINGS);
	});

	it("round-trips what it returns", () => {
		const settings = withCycle({ corner: false });
		expect(
			normalizeSudokuInputSettings(JSON.parse(JSON.stringify(settings))),
		).toEqual(settings);
	});
});

describe("cornerNoteGroups", () => {
	it("draws nothing without notes", () => {
		expect(cornerNoteGroups(0, "spread")).toEqual([]);
		expect(cornerNoteGroups(0, "topRight")).toEqual([]);
	});

	it("spreads notes over the corners, then the edges", () => {
		expect(cornerNoteGroups(maskOf(2, 5, 7, 9, 4), "spread")).toEqual([
			{ slot: "topLeft", digits: [2] },
			{ slot: "topRight", digits: [4] },
			{ slot: "bottomLeft", digits: [5] },
			{ slot: "bottomRight", digits: [7] },
			{ slot: "top", digits: [9] },
		]);
	});

	it("shares the last spread slot when all nine are noted", () => {
		const groups = cornerNoteGroups(
			maskOf(1, 2, 3, 4, 5, 6, 7, 8, 9),
			"spread",
		);
		expect(groups).toHaveLength(8);
		expect(groups.at(-1)).toEqual({ slot: "right", digits: [8, 9] });
		expect(groups.flatMap((group) => group.digits)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9,
		]);
	});

	it("puts every note together in the top-right corner", () => {
		expect(cornerNoteGroups(maskOf(9, 1, 6), "topRight")).toEqual([
			{ slot: "topRight", digits: [1, 6, 9] },
		]);
	});
});

describe("isModeCycleTap", () => {
	const selection = { cell: 10, selectedAt: 1_000 };

	it("cycles on a later tap on the selected cell", () => {
		expect(isModeCycleTap(10, selection, 1_000 + RETAP_GRACE_MS)).toBe(true);
	});

	it("treats a quick second tap as the same double tap", () => {
		expect(isModeCycleTap(10, selection, 1_000 + RETAP_GRACE_MS - 1)).toBe(
			false,
		);
	});

	it("never cycles on a tap on another cell", () => {
		expect(isModeCycleTap(11, selection, 10_000)).toBe(false);
		expect(isModeCycleTap(10, { cell: null, selectedAt: 0 }, 10_000)).toBe(
			false,
		);
	});
});
