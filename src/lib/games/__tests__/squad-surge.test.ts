import { mulberry32 } from "@arcadeclub/core/sudoku";
import { describe, expect, it } from "vitest";
import { applyGate, generateLevel, resolveWave } from "../squad-surge";

describe("mulberry32", () => {
	it("returns identical sequences for identical seeds", () => {
		const a = mulberry32(1234);
		const b = mulberry32(1234);
		for (let i = 0; i < 20; i += 1) {
			expect(a()).toBe(b());
		}
	});
});

describe("generateLevel", () => {
	it("is deterministic for the same seed and difficulty", () => {
		expect(generateLevel(42, 2)).toEqual(generateLevel(42, 2));
	});

	it("higher difficulty yields more waves and a larger boss", () => {
		const easy = generateLevel(42, 1);
		const hard = generateLevel(42, 4);
		expect(hard.waves.length).toBeGreaterThan(easy.waves.length);
		expect(hard.boss).toBeGreaterThan(easy.boss);
	});

	it("sorts gate pairs and waves by z within the track", () => {
		const level = generateLevel(7, 3);
		const gateZs = level.gatePairs.map((pair) => pair.z);
		expect(gateZs).toEqual([...gateZs].sort((a, b) => a - b));
		const waveZs = level.waves.map((wave) => wave.z);
		expect(waveZs).toEqual([...waveZs].sort((a, b) => a - b));
		for (const z of [...gateZs, ...waveZs]) {
			expect(z).toBeGreaterThan(0);
			expect(z).toBeLessThan(level.length);
		}
	});
});

describe("applyGate", () => {
	it("mul multiplies and floors", () => {
		expect(applyGate(7, { side: 0, op: "mul", value: 2 })).toBe(14);
		expect(applyGate(7, { side: 0, op: "mul", value: 1.5 })).toBe(10);
	});

	it("add adds", () => {
		expect(applyGate(7, { side: 0, op: "add", value: 15 })).toBe(22);
	});

	it("sub subtracts", () => {
		expect(applyGate(20, { side: 0, op: "sub", value: 8 })).toBe(12);
	});

	it("never returns a negative army", () => {
		expect(applyGate(5, { side: 0, op: "sub", value: 50 })).toBe(0);
	});
});

describe("resolveWave", () => {
	it("reduces the army by strength", () => {
		expect(resolveWave(30, 12)).toBe(18);
	});

	it("never goes below zero", () => {
		expect(resolveWave(5, 12)).toBe(0);
	});
});
