import { describe, expect, it } from "vitest";
import { guessDigit } from "../sudoku-digit-net";
import { darkness, GLYPH, glyphImage, gridInk } from "../sudoku-scan-glyphs";
import { drawGrid } from "../testing/drawn-grid";

describe("guessDigit", () => {
	it.each([1, 2, 4, 7])("reads a drawn %i", (digit) => {
		const { gray } = drawGrid({ digits: [{ row: 0, column: 0, digit }] });
		const ink = gridInk(darkness(gray))[0];
		if (ink.kind !== "digit") throw new Error("no digit");
		const guess = guessDigit(glyphImage(ink.ink));
		expect(guess.digit).toBe(digit);
		expect(guess.confidence).toBeGreaterThan(0.8);
		expect(guess.junk).toBeLessThan(0.1);
	});

	it("takes a solid block for no digit", () => {
		const block = new Float32Array(GLYPH * GLYPH);
		for (let y = 3; y < 25; y += 1)
			block.fill(1, y * GLYPH + 3, y * GLYPH + 25);
		expect(guessDigit(block).junk).toBeGreaterThan(0.5);
	});
});
