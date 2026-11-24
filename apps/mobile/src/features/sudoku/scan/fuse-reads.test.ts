import { fuseReads } from "./fuse-reads";

const guess = (digit: number, confidence: number, junk = 0) => ({
	digit,
	confidence,
	junk,
	printScore: 0,
});

describe("fuseReads", () => {
	it("is as sure as the surest of two that agree", () => {
		expect(fuseReads({ digit: 4, confidence: 0.5 }, guess(4, 0.95))).toEqual({
			digit: 4,
			confidence: 0.95,
		});
	});

	it("takes the network's digit when Vision reads nothing", () => {
		expect(fuseReads({ digit: 0, confidence: 0 }, guess(7, 0.9))).toEqual({
			digit: 7,
			confidence: 0.9,
		});
	});

	it("reads nothing in ink that neither takes for a digit", () => {
		const nothing = { digit: 0, confidence: 0 };
		expect(fuseReads(nothing, guess(7, 0.1, 0.85))).toEqual(nothing);
	});

	it("takes the surest of two that differ, for the player to check", () => {
		expect(fuseReads({ digit: 4, confidence: 1 }, guess(9, 0.5))).toEqual({
			digit: 4,
			confidence: 0.6,
		});
		expect(fuseReads({ digit: 4, confidence: 0.5 }, guess(9, 0.98))).toEqual({
			digit: 9,
			confidence: 0.6,
		});
	});

	it("believes the network about a 6 or a 9", () => {
		expect(fuseReads({ digit: 6, confidence: 1 }, guess(9, 0.5)).digit).toBe(9);
	});
});
