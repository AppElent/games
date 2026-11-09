import { describe, expect, it } from "vitest";
import { GameRuleError } from "../errors";
import { digitsToString } from "../puzzle";
import { mulberry32 } from "../random";
import { SUDOKU_VARIANTS } from "../sudoku";
import {
	generateVariantPuzzle,
	isVariantGridString,
	SUDOKU_VARIANT_RULES,
} from "../sudoku-variants";

function shapeOf(puzzle: ReturnType<typeof generateVariantPuzzle>) {
	return {
		size: puzzle.variant === "binary" ? puzzle.size : undefined,
		cages: puzzle.variant === "killer" ? puzzle.cages : undefined,
	};
}

describe("generateVariantPuzzle", () => {
	it.each(
		SUDOKU_VARIANTS,
	)("makes a %s puzzle its own rules call solved by its solution", (variant) => {
		const puzzle = generateVariantPuzzle(variant, "easy", mulberry32(7));
		const rules = SUDOKU_VARIANT_RULES[variant];
		const shape = shapeOf(puzzle);
		expect(puzzle.variant).toBe(variant);
		expect(puzzle.givens).toHaveLength(rules.cells(shape));
		expect(rules.solved(puzzle.solution, shape)).toBe(true);
		expect(rules.solved(puzzle.givens, shape)).toBe(false);
		expect(rules.conflicts(puzzle.givens, shape).size).toBe(0);
		expect(
			isVariantGridString(variant, shape, digitsToString(puzzle.solution)),
		).toBe(true);
	});

	it("gives the same puzzle for the same seed", () => {
		expect(generateVariantPuzzle("killer", "easy", mulberry32(3))).toEqual(
			generateVariantPuzzle("killer", "easy", mulberry32(3)),
		);
	});
});

describe("isVariantGridString", () => {
	it("checks length and digit range per variant", () => {
		expect(isVariantGridString("classic", {}, "9".repeat(81))).toBe(true);
		expect(isVariantGridString("classic", {}, "0".repeat(80))).toBe(false);
		expect(isVariantGridString("killer", {}, `${"0".repeat(80)}x`)).toBe(false);
		expect(isVariantGridString("binary", { size: 6 }, "2".repeat(36))).toBe(
			true,
		);
		expect(isVariantGridString("binary", { size: 6 }, "3".repeat(36))).toBe(
			false,
		);
	});

	it("refuses a binary board of a size no puzzle uses", () => {
		expect(() =>
			isVariantGridString("binary", { size: 7 }, "0".repeat(49)),
		).toThrow(new GameRuleError("invalidBinarySize"));
		expect(() => SUDOKU_VARIANT_RULES.binary.cells({})).toThrow(GameRuleError);
	});
});

describe("SUDOKU_VARIANT_RULES", () => {
	it("checks binary rules for binary boards and digit clashes otherwise", () => {
		const clash = [1, 1, ...new Array(79).fill(0)];
		expect(SUDOKU_VARIANT_RULES.classic.conflicts(clash, {})).toEqual(
			new Set([0, 1]),
		);
		expect(SUDOKU_VARIANT_RULES.killer.conflicts(clash, {})).toEqual(
			new Set([0, 1]),
		);
		const triple = [1, 1, 1, ...new Array(33).fill(0)];
		expect(
			SUDOKU_VARIANT_RULES.binary.conflicts(triple, { size: 6 }).size,
		).toBeGreaterThan(0);
	});
});
