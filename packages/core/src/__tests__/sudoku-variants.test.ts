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

describe("generateVariantPuzzle", () => {
	it.each(
		SUDOKU_VARIANTS,
	)("makes a %s puzzle its own rules call solved by its solution", (variant) => {
		const puzzle = generateVariantPuzzle(variant, "easy", mulberry32(7));
		const rules = SUDOKU_VARIANT_RULES[variant];
		const shape = rules.stored(puzzle);
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

describe("SUDOKU_VARIANT_RULES validate", () => {
	const killer = generateVariantPuzzle("killer", "easy", mulberry32(5));
	const cages = killer.variant === "killer" ? killer.cages : [];

	it("accepts any classic or binary shape", () => {
		expect(() =>
			SUDOKU_VARIANT_RULES.classic.validate({}, undefined),
		).not.toThrow();
		expect(() =>
			SUDOKU_VARIANT_RULES.binary.validate({ size: 6 }, undefined),
		).not.toThrow();
	});

	it("accepts killer cages that cover the board and fit the solution", () => {
		expect(() =>
			SUDOKU_VARIANT_RULES.killer.validate({ cages }, killer.solution),
		).not.toThrow();
		expect(() =>
			SUDOKU_VARIANT_RULES.killer.validate({ cages }, undefined),
		).not.toThrow();
	});

	it("refuses missing or partial killer cages", () => {
		expect(() => SUDOKU_VARIANT_RULES.killer.validate({}, undefined)).toThrow(
			new GameRuleError("invalidKillerCages"),
		);
		expect(() =>
			SUDOKU_VARIANT_RULES.killer.validate(
				{ cages: [{ sum: 3, cells: [0, 1] }] },
				undefined,
			),
		).toThrow(new GameRuleError("invalidKillerCages"));
	});

	it("refuses a solution that breaks a cage sum", () => {
		const wrongSums = cages.map((cage, index) =>
			index === 0 ? { ...cage, sum: cage.sum + 1 } : cage,
		);
		expect(() =>
			SUDOKU_VARIANT_RULES.killer.validate(
				{ cages: wrongSums },
				killer.solution,
			),
		).toThrow(new GameRuleError("cagesUnsatisfied"));
	});
});

describe("SUDOKU_VARIANT_RULES stored", () => {
	const cages = [{ sum: 3, cells: [0, 1] }];

	it("keeps only what each variant stores beside its grids", () => {
		expect(SUDOKU_VARIANT_RULES.classic.stored({ size: 6, cages })).toEqual({});
		expect(SUDOKU_VARIANT_RULES.killer.stored({ size: 6, cages })).toEqual({
			cages,
		});
		expect(SUDOKU_VARIANT_RULES.binary.stored({ size: 6, cages })).toEqual({
			size: 6,
		});
	});
});
