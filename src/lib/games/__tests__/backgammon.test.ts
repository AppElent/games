import { describe, expect, it } from "vitest";
import {
	applyBackgammonPrototypeMove,
	countBackgammonCheckers,
	createInitialBackgammonState,
	getBackgammonPoint,
	rollBackgammonDice,
	switchBackgammonColor,
} from "../backgammon";

describe("backgammon prototype helpers", () => {
	it("creates the standard 24 point opening snapshot", () => {
		const state = createInitialBackgammonState();

		expect(state.points).toHaveLength(24);
		expect(countBackgammonCheckers(state, "white")).toBe(15);
		expect(countBackgammonCheckers(state, "black")).toBe(15);
		expect(getBackgammonPoint(state, 24)).toEqual({
			point: 24,
			color: "white",
			count: 2,
		});
		expect(getBackgammonPoint(state, 1)).toEqual({
			point: 1,
			color: "black",
			count: 2,
		});
	});

	it("rolls two dice in the one to six range", () => {
		const dice = rollBackgammonDice(() => 0.99);

		expect(dice).toEqual([6, 6]);
	});

	it("applies a prototype point to point move", () => {
		const state = {
			...createInitialBackgammonState(),
			dice: [3, 1],
		};

		const result = applyBackgammonPrototypeMove(state, {
			color: "white",
			from: 24,
			to: 23,
		});

		expect(getBackgammonPoint(result.state, 24)).toEqual({
			point: 24,
			color: "white",
			count: 1,
		});
		expect(getBackgammonPoint(result.state, 23)).toEqual({
			point: 23,
			color: "white",
			count: 1,
		});
		expect(result.usedDie).toBe(3);
	});

	it("moves a checker off the board in prototype mode", () => {
		const state = {
			...createInitialBackgammonState(),
			dice: [6, 2],
		};

		const result = applyBackgammonPrototypeMove(state, {
			color: "white",
			from: 24,
			to: "off",
		});

		expect(getBackgammonPoint(result.state, 24)?.count).toBe(1);
		expect(result.state.off.white).toBe(1);
	});

	it("rejects moving before dice are rolled", () => {
		const state = createInitialBackgammonState();

		expect(() =>
			applyBackgammonPrototypeMove(state, {
				color: "white",
				from: 24,
				to: 23,
			}),
		).toThrow("Roll before moving");
	});

	it("rejects moving after all dice are used", () => {
		const state = {
			...createInitialBackgammonState(),
			dice: [3],
			usedDice: [3],
		};

		expect(() =>
			applyBackgammonPrototypeMove(state, {
				color: "white",
				from: 24,
				to: 23,
			}),
		).toThrow("Roll before moving");
	});

	it("rejects moving from an empty or opponent point", () => {
		const state = {
			...createInitialBackgammonState(),
			dice: [3, 1],
		};

		expect(() =>
			applyBackgammonPrototypeMove(state, {
				color: "white",
				from: 2,
				to: 3,
			}),
		).toThrow("Choose a point with your checker");
		expect(() =>
			applyBackgammonPrototypeMove(state, {
				color: "white",
				from: 1,
				to: 2,
			}),
		).toThrow("Choose a point with your checker");
	});

	it("rejects moving to an opponent-occupied point without mutating caller state", () => {
		const state = {
			...createInitialBackgammonState(),
			dice: [6],
		};

		expect(() =>
			applyBackgammonPrototypeMove(state, {
				color: "white",
				from: 24,
				to: 1,
			}),
		).toThrow("Invalid destination");
		expect(countBackgammonCheckers(state, "white")).toBe(15);
		expect(countBackgammonCheckers(state, "black")).toBe(15);
	});

	it("switches active colors", () => {
		expect(switchBackgammonColor("white")).toBe("black");
		expect(switchBackgammonColor("black")).toBe("white");
	});
});
