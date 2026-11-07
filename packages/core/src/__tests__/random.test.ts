import { describe, expect, it } from "vitest";
import { mulberry32, shuffle } from "../random";

describe("mulberry32", () => {
	it("returns identical sequences for identical seeds", () => {
		const a = mulberry32(1234);
		const b = mulberry32(1234);
		for (let i = 0; i < 20; i += 1) {
			expect(a()).toBe(b());
		}
	});
});

describe("shuffle", () => {
	it("draws from the last index down and does not touch its input", () => {
		const items = [1, 2, 3, 4];
		const draws: number[] = [];
		const result = shuffle(items, () => {
			draws.push(draws.length);
			return 0;
		});
		expect(draws).toHaveLength(3);
		expect(result).toEqual([2, 3, 4, 1]);
		expect(items).toEqual([1, 2, 3, 4]);
	});

	it("keeps seeded output stable", () => {
		expect(shuffle([0, 1, 2, 3, 4, 5, 6, 7], mulberry32(42))).toEqual([
			2, 7, 1, 0, 6, 5, 3, 4,
		]);
	});
});
