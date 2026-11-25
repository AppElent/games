import { describe, expect, it } from "vitest";
import { arePrinted } from "../sudoku-scan-printed";

const print = (score = 3) => ({ score, height: 60, darkness: 0.8 });
const pen = (score = -3) => ({ score, height: 48, darkness: 0.5 });
const repeat = <T>(count: number, value: T) =>
	Array.from({ length: count }, () => value);

describe("arePrinted", () => {
	it("tells print from handwriting", () => {
		const result = arePrinted([...repeat(5, print()), ...repeat(3, pen())]);
		expect(result).toEqual([...repeat(5, true), ...repeat(3, false)]);
	});

	it("goes by size and ink when the shape could be either", () => {
		const digits = [...repeat(5, print()), pen(), pen(0.3), print(-0.3)];
		expect(arePrinted(digits).slice(5)).toEqual([false, false, true]);
	});

	it("takes every digit of a clean print for printed", () => {
		expect(arePrinted([...repeat(5, print()), print(-0.5)])).toEqual(
			repeat(6, true),
		);
	});

	it("goes by the shape alone when there is little print", () => {
		expect(arePrinted([pen(), print(0.5)])).toEqual([false, true]);
	});
});
