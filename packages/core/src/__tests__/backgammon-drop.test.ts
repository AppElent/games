import { describe, expect, it } from "vitest";
import {
	type BackgammonColor,
	type BackgammonTurnState,
	createInitialBackgammonState,
	planBackgammonMove,
	remainingBackgammonDice,
	resolveBackgammonDrop,
} from "../backgammon";

/** The opening position with White to move, `dice` rolled and `extra` points overridden. */
function opening(
	dice: number[],
	extra: Record<number, [BackgammonColor, number] | null> = {},
): BackgammonTurnState {
	const state = createInitialBackgammonState();
	return {
		...state,
		points: state.points.map((point) => {
			const entry = extra[point.point];
			if (entry === undefined) return point;
			return entry
				? { point: point.point, color: entry[0], count: entry[1] }
				: { point: point.point, count: 0 };
		}),
		dice,
		used: dice.map(() => false),
	};
}

describe("resolveBackgammonDrop", () => {
	it("commits the plan tap-to-move would make", () => {
		const state = opening([5, 3]);
		const outcome = resolveBackgammonDrop(state, 8, 3, true);
		expect(outcome).toEqual({
			kind: "move",
			plan: planBackgammonMove(state, 8, 3, true),
			hits: [],
		});
	});

	it("commits a combined move only when combining is on", () => {
		const state = opening([5, 3]);
		expect(resolveBackgammonDrop(state, 13, 5, true)).toMatchObject({
			kind: "move",
			plan: {
				steps: [
					{ from: 13, to: 8 },
					{ from: 8, to: 5 },
				],
			},
		});
		expect(resolveBackgammonDrop(state, 13, 5, false)).toEqual({
			kind: "reject",
			reason: "reach",
		});
	});

	it("lists the blots a move hits, including on the way", () => {
		const single = opening([5, 3], { 3: ["black", 1] });
		expect(resolveBackgammonDrop(single, 8, 3, true)).toMatchObject({
			kind: "move",
			hits: [3],
		});
		const combined = opening([3, 2], { 5: ["black", 1], 3: ["black", 1] });
		const outcome = resolveBackgammonDrop(combined, 8, 3, true);
		expect(outcome).toMatchObject({
			kind: "move",
			plan: { steps: [{ to: 5 }, { to: 3 }] },
			hits: [5, 3],
		});
	});

	it("bears off when dropped on the tray", () => {
		const state: BackgammonTurnState = {
			...opening([6, 1]),
			points: createInitialBackgammonState().points.map((point) =>
				point.point === 6
					? { point: 6, color: "white", count: 15 }
					: point.color === "white"
						? { point: point.point, count: 0 }
						: point,
			),
		};
		expect(resolveBackgammonDrop(state, 6, "off", true)).toMatchObject({
			kind: "move",
			plan: { steps: [{ from: 6, to: "off", die: 6 }] },
			hits: [],
		});
	});

	it("says a point held by two or more opposing checkers is blocked", () => {
		const state = opening([5, 3]);
		expect(resolveBackgammonDrop(state, 8, 1, true)).toEqual({
			kind: "reject",
			reason: "blocked",
			point: 1,
		});
	});

	it("says an open point the dice cannot reach is out of reach", () => {
		const state = opening([5, 3]);
		expect(resolveBackgammonDrop(state, 8, 4, true)).toEqual({
			kind: "reject",
			reason: "reach",
		});
		// A lone opposing blot is open, so it is never "blocked".
		const blot = opening([5, 3], { 4: ["black", 1] });
		expect(resolveBackgammonDrop(blot, 8, 4, true)).toEqual({
			kind: "reject",
			reason: "reach",
		});
	});

	it("rejects the bar and an unlit tray", () => {
		const state = opening([5, 3]);
		expect(resolveBackgammonDrop(state, 8, "bar", true)).toEqual({
			kind: "reject",
			reason: "reach",
		});
		expect(resolveBackgammonDrop(state, 8, "off", true)).toEqual({
			kind: "reject",
			reason: "reach",
		});
	});

	it("cancels a drop on its own point or off the board", () => {
		const state = opening([5, 3]);
		expect(resolveBackgammonDrop(state, 8, 8, true)).toEqual({
			kind: "cancel",
		});
		expect(resolveBackgammonDrop(state, 8, null, true)).toEqual({
			kind: "cancel",
		});
		const entering = { ...state, bar: { white: 1, black: 0 } };
		expect(resolveBackgammonDrop(entering, "bar", "bar", true)).toEqual({
			kind: "cancel",
		});
	});

	it("enters from the bar", () => {
		const state = { ...opening([5, 3]), bar: { white: 1, black: 0 } };
		expect(resolveBackgammonDrop(state, "bar", 20, true)).toMatchObject({
			kind: "move",
			plan: { steps: [{ from: "bar", to: 20, die: 5 }] },
		});
	});
});

describe("remainingBackgammonDice", () => {
	it("lists unspent dice in roll order", () => {
		expect(
			remainingBackgammonDice({
				dice: [4, 4, 4, 4],
				used: [true, false, false, false],
			}),
		).toEqual([4, 4, 4]);
		expect(
			remainingBackgammonDice({ dice: [5, 3], used: [false, true] }),
		).toEqual([5]);
	});
});
