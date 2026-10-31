import { describe, expect, it } from "vitest";
import {
	applyBackgammonMove,
	applyBackgammonPlan,
	type BackgammonTurnState,
	canBearOff,
	computeUsedFlags,
	countBackgammonCheckers,
	createInitialBackgammonState,
	getBackgammonPoint,
	getBackgammonWinner,
	getMoveHighlights,
	planBackgammonMove,
	rollBackgammonDice,
	switchBackgammonColor,
} from "../backgammon";

function withDice(
	state: BackgammonTurnState,
	dice: number[],
	used?: boolean[],
): BackgammonTurnState {
	return { ...state, dice, used: used ?? dice.map(() => false) };
}

describe("backgammon engine", () => {
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

	it("expands doubles into four dice", () => {
		expect(rollBackgammonDice(() => 0.99)).toEqual([6, 6, 6, 6]);
		const sequence = [0.1, 0.6];
		let call = 0;
		expect(rollBackgammonDice(() => sequence[call++])).toEqual([1, 4]);
	});

	it("maps convex used-dice values onto index flags", () => {
		expect(computeUsedFlags([4, 2], [2])).toEqual([false, true]);
		expect(computeUsedFlags([5, 5, 5, 5], [5, 5])).toEqual([
			true,
			true,
			false,
			false,
		]);
	});

	it("applies a validated move using the matching die", () => {
		const state = withDice(createInitialBackgammonState(), [3, 1]);

		const result = applyBackgammonMove(state, {
			color: "white",
			from: 24,
			to: 23,
		});

		expect(result.usedDie).toBe(1);
		expect(getBackgammonPoint(result.state, 23)?.count).toBe(1);
		expect(result.state.used).toEqual([false, true]);
	});

	it("rejects a move that matches no unused die", () => {
		const state = withDice(createInitialBackgammonState(), [3, 1]);

		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 24, to: 19 }),
		).toThrow("Invalid destination");
	});

	it("rejects landing on a made point and allows hitting a blot", () => {
		const state = withDice(createInitialBackgammonState(), [5, 3]);
		// 24 - 5 = point 19, held by 5 black checkers
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 24, to: 19 }),
		).toThrow("Invalid destination");

		// Put a lone black blot on point 21 and hit it with 24 - 3.
		const blot = withDice(createInitialBackgammonState(), [5, 3]);
		blot.points[20] = { point: 21, color: "black", count: 1 };
		const result = applyBackgammonMove(blot, {
			color: "white",
			from: 24,
			to: 21,
		});
		expect(result.state.bar.black).toBe(1);
		expect(getBackgammonPoint(result.state, 21)).toEqual({
			point: 21,
			color: "white",
			count: 1,
		});
	});

	it("forces re-entry from the bar first", () => {
		const state = withDice(createInitialBackgammonState(), [4, 2]);
		state.bar.white = 1;

		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 24, to: 22 }),
		).toThrow("Enter from the bar first");

		// bar entry for white with die 4 lands on 25 - 4 = 21
		const result = applyBackgammonMove(state, {
			color: "white",
			from: "bar",
			to: 21,
		});
		expect(result.state.bar.white).toBe(0);
		expect(getBackgammonPoint(result.state, 21)?.color).toBe("white");
	});

	it("plans combined two-die moves", () => {
		const state = withDice(createInitialBackgammonState(), [3, 2]);

		// 24 -> 21 -> 19 is blocked (19 has 5 black), 24 -> 22 -> 19 also; use 13 -> 10 -> 8
		const plan = planBackgammonMove(state, 13, 8, true);
		expect(plan?.steps).toHaveLength(2);
		expect(plan?.steps.map((step) => step.die).sort()).toEqual([2, 3]);

		const next = applyBackgammonPlan(state, plan ?? { steps: [] });
		expect(getBackgammonPoint(next, 8)?.count).toBe(4);
		expect(next.used).toEqual([true, true]);
	});

	it("highlights reachable destinations including combos", () => {
		const state = withDice(createInitialBackgammonState(), [3, 2]);
		const highlights = getMoveHighlights(state, 13, true);
		expect(highlights.points.has(11)).toBe(true);
		expect(highlights.points.has(10)).toBe(true);
		expect(highlights.points.has(8)).toBe(true);
		expect(highlights.off).toBe(false);
	});

	it("only allows bear-off with all checkers home", () => {
		const opening = createInitialBackgammonState();
		expect(canBearOff(opening.points, opening.bar, "white")).toBe(false);

		const state = createInitialBackgammonState();
		state.points = state.points.map((point) => ({
			point: point.point,
			count: 0,
		}));
		state.points[5] = { point: 6, color: "white", count: 15 };
		expect(canBearOff(state.points, state.bar, "white")).toBe(true);

		const ready = withDice(state, [6, 2]);
		const result = applyBackgammonMove(ready, {
			color: "white",
			from: 6,
			to: "off",
		});
		expect(result.state.off.white).toBe(1);
		expect(result.usedDie).toBe(6);
	});

	it("rejects moving before dice are rolled or when it is not your turn", () => {
		const state = createInitialBackgammonState();
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 24, to: 23 }),
		).toThrow("Roll before moving");
		expect(() =>
			applyBackgammonMove(withDice(state, [3, 1]), {
				color: "black",
				from: 1,
				to: 4,
			}),
		).toThrow("It is not your turn");
	});

	it("rejects moving from an empty or opponent point", () => {
		const state = withDice(createInitialBackgammonState(), [3, 1]);
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 2, to: 3 }),
		).toThrow("Choose a point with your checker");
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 1, to: 2 }),
		).toThrow("Choose a point with your checker");
		// caller state untouched
		expect(countBackgammonCheckers(state, "white")).toBe(15);
	});

	it("detects the winner", () => {
		expect(getBackgammonWinner({ white: 15, black: 3 })).toBe("white");
		expect(getBackgammonWinner({ white: 14, black: 15 })).toBe("black");
		expect(getBackgammonWinner({ white: 0, black: 0 })).toBeNull();
	});

	it("switches active colors", () => {
		expect(switchBackgammonColor("white")).toBe("black");
		expect(switchBackgammonColor("black")).toBe("white");
	});
});
