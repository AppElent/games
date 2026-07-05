import { describe, expect, it } from "vitest";
import {
	applyGate,
	generateLevel,
	initialState,
	isTerminal,
	type Level,
	mulberry32,
	resolveWave,
	SPEED,
	stepSimulation,
} from "../squad-surge";

function makeLevel(overrides: Partial<Level> = {}): Level {
	return {
		seed: 0,
		difficulty: 1,
		length: 100,
		gatePairs: [],
		waves: [],
		boss: 10,
		startArmy: 10,
		...overrides,
	};
}

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

describe("stepSimulation", () => {
	it("advances z by SPEED * dt", () => {
		const level = makeLevel();
		const state = initialState(level);
		const next = stepSimulation(state, { targetLane: 0.5 }, 0.1, level);
		expect(next.z).toBeCloseTo(SPEED * 0.1);
	});

	it("eases lane toward the target and stays clamped", () => {
		const level = makeLevel();
		let state = initialState(level);
		state = stepSimulation(state, { targetLane: 1 }, 0.05, level);
		expect(state.lane).toBeGreaterThan(0.5);
		expect(state.lane).toBeLessThanOrEqual(1);
		for (let i = 0; i < 100; i += 1) {
			state = stepSimulation(state, { targetLane: 5 }, 0.05, level);
		}
		expect(state.lane).toBeLessThanOrEqual(1);
		for (let i = 0; i < 100; i += 1) {
			state = stepSimulation(state, { targetLane: -5 }, 0.05, level);
		}
		expect(state.lane).toBeGreaterThanOrEqual(0);
	});

	it("applies the left gate when lane < 0.5", () => {
		const level = makeLevel({
			gatePairs: [
				{
					z: 1,
					gates: [
						{ side: 0, op: "add", value: 100 },
						{ side: 1, op: "sub", value: 5 },
					],
				},
			],
		});
		let state = { ...initialState(level), lane: 0.1 };
		state = stepSimulation(state, { targetLane: 0 }, 0.5, level);
		expect(state.army).toBe(110);
		expect(state.nextGateIdx).toBe(1);
	});

	it("applies the right gate when lane >= 0.5", () => {
		const level = makeLevel({
			gatePairs: [
				{
					z: 1,
					gates: [
						{ side: 0, op: "add", value: 100 },
						{ side: 1, op: "sub", value: 5 },
					],
				},
			],
		});
		let state = { ...initialState(level), lane: 0.9 };
		state = stepSimulation(state, { targetLane: 1 }, 0.5, level);
		expect(state.army).toBe(5);
	});

	it("marks the run lost when a wave empties the army", () => {
		const level = makeLevel({
			startArmy: 10,
			waves: [{ z: 1, strength: 10 }],
		});
		const state = stepSimulation(
			initialState(level),
			{ targetLane: 0.5 },
			0.5,
			level,
		);
		expect(state.army).toBe(0);
		expect(state.status).toBe("lost");
	});

	it("wins the boss fight when army > boss", () => {
		const level = makeLevel({ length: 1, boss: 5, startArmy: 6 });
		const state = stepSimulation(
			initialState(level),
			{ targetLane: 0.5 },
			0.5,
			level,
		);
		expect(state.status).toBe("won");
	});

	it("loses the boss fight when army <= boss", () => {
		const level = makeLevel({ length: 1, boss: 6, startArmy: 6 });
		const state = stepSimulation(
			initialState(level),
			{ targetLane: 0.5 },
			0.5,
			level,
		);
		expect(state.status).toBe("lost");
	});

	it("keeps terminal states sticky", () => {
		const level = makeLevel({ length: 1, boss: 5, startArmy: 6 });
		const won = stepSimulation(
			initialState(level),
			{ targetLane: 0.5 },
			0.5,
			level,
		);
		expect(won.status).toBe("won");
		expect(isTerminal(won)).toBe(true);
		const after = stepSimulation(won, { targetLane: 0 }, 0.5, level);
		expect(after).toEqual(won);
	});

	it("resolves interleaved gates and waves in z order", () => {
		// Wave first (10 - 8 = 2), then gate doubles (2 * 2 = 4). If the gate
		// resolved first (10 * 2 - 8 = 12) the result would differ.
		const level = makeLevel({
			startArmy: 10,
			waves: [{ z: 1, strength: 8 }],
			gatePairs: [
				{
					z: 2,
					gates: [
						{ side: 0, op: "mul", value: 2 },
						{ side: 1, op: "mul", value: 2 },
					],
				},
			],
		});
		const state = stepSimulation(
			initialState(level),
			{ targetLane: 0 },
			0.5,
			level,
		);
		expect(state.army).toBe(4);
	});

	it("plays a full scripted run deterministically", () => {
		const level = generateLevel(1234, 2);
		const run = () => {
			let state = initialState(level);
			let frame = 0;
			while (!isTerminal(state) && frame < 10_000) {
				// Steer toward the better upcoming gate; drift center otherwise.
				const pair = level.gatePairs[state.nextGateIdx];
				let target = 0.5;
				if (pair) {
					const [a, b] = pair.gates;
					const bestSide =
						applyGate(state.army, a) >= applyGate(state.army, b)
							? a.side
							: b.side;
					target = bestSide === 0 ? 0 : 1;
				}
				state = stepSimulation(state, { targetLane: target }, 1 / 60, level);
				frame += 1;
			}
			return state;
		};
		const first = run();
		const second = run();
		expect(first).toEqual(second);
		expect(isTerminal(first)).toBe(true);
	});
});
