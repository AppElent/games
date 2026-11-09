import { describe, expect, it } from "vitest";
import {
	applyBackgammonMove,
	applyBackgammonPlan,
	type BackgammonColor,
	type BackgammonTurnState,
	canBearOff,
	canEndBackgammonTurn,
	computeUsedFlags,
	createInitialBackgammonState,
	getBackgammonPoint,
	getBackgammonWinner,
	getMoveHighlights,
	hasLegalBackgammonMove,
	isTurnSpent,
	planBackgammonMove,
	rollBackgammonDice,
	shouldAutoEndTurn,
	toTurnState,
} from "../backgammon";

function withDice(
	state: BackgammonTurnState,
	dice: number[],
	used?: boolean[],
): BackgammonTurnState {
	return { ...state, dice, used: used ?? dice.map(() => false) };
}

function countBackgammonCheckers(
	state: Pick<BackgammonTurnState, "points" | "bar" | "off">,
	color: BackgammonColor,
) {
	const onBoard = state.points.reduce(
		(total, point) => total + (point.color === color ? point.count : 0),
		0,
	);
	return onBoard + state.bar[color] + state.off[color];
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
		).toThrow("invalidDestination");
	});

	it("rejects landing on a made point and allows hitting a blot", () => {
		const state = withDice(createInitialBackgammonState(), [5, 3]);
		// 24 - 5 = point 19, held by 5 black checkers
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 24, to: 19 }),
		).toThrow("invalidDestination");

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
		).toThrow("enterFromBarFirst");

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
		).toThrow("rollBeforeMoving");
		expect(() =>
			applyBackgammonMove(withDice(state, [3, 1]), {
				color: "black",
				from: 1,
				to: 4,
			}),
		).toThrow("notYourTurn");
	});

	it("rejects moving from an empty or opponent point", () => {
		const state = withDice(createInitialBackgammonState(), [3, 1]);
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 2, to: 3 }),
		).toThrow("choosePointWithChecker");
		expect(() =>
			applyBackgammonMove(state, { color: "white", from: 1, to: 2 }),
		).toThrow("choosePointWithChecker");
		// caller state untouched
		expect(countBackgammonCheckers(state, "white")).toBe(15);
	});

	it("knows when the active player has no legal move left", () => {
		const opening = createInitialBackgammonState();
		expect(hasLegalBackgammonMove(opening)).toBe(false);
		expect(hasLegalBackgammonMove(withDice(opening, [3, 1]))).toBe(true);
		expect(
			hasLegalBackgammonMove(withDice(opening, [3, 1], [true, true])),
		).toBe(false);

		// White on the bar facing a closed black home board cannot enter.
		const blocked = withDice(
			{
				...opening,
				points: opening.points.map((point) =>
					point.point >= 19
						? { point: point.point, color: "black" as const, count: 2 }
						: { point: point.point, count: 0 },
				),
				bar: { white: 1, black: 0 },
			},
			[6, 5],
		);
		expect(hasLegalBackgammonMove(blocked)).toBe(false);
		expect(
			hasLegalBackgammonMove({
				...blocked,
				points: blocked.points.map((point) =>
					point.point === 20 ? { point: 20, count: 0 } : point,
				),
			}),
		).toBe(true);
	});

	it("allows ending the turn only once no die can be played", () => {
		const opening = createInitialBackgammonState();
		expect(canEndBackgammonTurn(opening)).toBe(false);
		expect(canEndBackgammonTurn(withDice(opening, [3, 1]))).toBe(false);
		expect(canEndBackgammonTurn(withDice(opening, [3, 1], [true, false]))).toBe(
			false,
		);
		expect(canEndBackgammonTurn(withDice(opening, [3, 1], [true, true]))).toBe(
			true,
		);
		const blocked = withDice(
			{
				...opening,
				points: opening.points.map((point) =>
					point.point >= 19
						? { point: point.point, color: "black" as const, count: 2 }
						: { point: point.point, count: 0 },
				),
				bar: { white: 1, black: 0 },
			},
			[6, 5],
		);
		expect(canEndBackgammonTurn(blocked)).toBe(true);
	});

	it("detects the winner", () => {
		expect(getBackgammonWinner({ white: 15, black: 3 })).toBe("white");
		expect(getBackgammonWinner({ white: 14, black: 15 })).toBe("black");
		expect(getBackgammonWinner({ white: 0, black: 0 })).toBeNull();
	});
});

/**
 * Pinned from the code before the highlight and plan traversals were merged:
 * what a source can reach, and which dice carry it there. `plans` lists steps
 * as `[from, to, die, dieIndex]`.
 */
const TRAVERSAL_TABLE: TraversalCase[] = [
	{
		name: "opening roll",
		spec: { dice: [3, 1] },
		rows: [
			{
				source: 24,
				combine: true,
				points: [20, 21, 23],
				off: false,
				plans: {
					"20": [
						[24, 21, 3, 0],
						[21, 20, 1, 1],
					],
					"21": [[24, 21, 3, 0]],
					"23": [[24, 23, 1, 1]],
				},
			},
			{
				source: 24,
				combine: false,
				points: [21, 23],
				off: false,
				plans: { "21": [[24, 21, 3, 0]], "23": [[24, 23, 1, 1]] },
			},
			{
				source: 13,
				combine: true,
				points: [9, 10],
				off: false,
				plans: {
					"9": [
						[13, 10, 3, 0],
						[10, 9, 1, 1],
					],
					"10": [[13, 10, 3, 0]],
				},
			},
			{
				source: 13,
				combine: false,
				points: [10],
				off: false,
				plans: { "10": [[13, 10, 3, 0]] },
			},
			{
				source: 8,
				combine: true,
				points: [4, 5, 7],
				off: false,
				plans: {
					"4": [
						[8, 5, 3, 0],
						[5, 4, 1, 1],
					],
					"5": [[8, 5, 3, 0]],
					"7": [[8, 7, 1, 1]],
				},
			},
			{
				source: 8,
				combine: false,
				points: [5, 7],
				off: false,
				plans: { "5": [[8, 5, 3, 0]], "7": [[8, 7, 1, 1]] },
			},
			{
				source: 6,
				combine: true,
				points: [2, 3, 5],
				off: false,
				plans: {
					"2": [
						[6, 3, 3, 0],
						[3, 2, 1, 1],
					],
					"3": [[6, 3, 3, 0]],
					"5": [[6, 5, 1, 1]],
				},
			},
			{
				source: 6,
				combine: false,
				points: [3, 5],
				off: false,
				plans: { "3": [[6, 3, 3, 0]], "5": [[6, 5, 1, 1]] },
			},
		],
	},
	{
		name: "opening roll for black",
		spec: { dice: [6, 4], active: "black" },
		rows: [
			{
				source: 1,
				combine: true,
				points: [5, 7, 11],
				off: false,
				plans: {
					"5": [[1, 5, 4, 1]],
					"7": [[1, 7, 6, 0]],
					"11": [
						[1, 7, 6, 0],
						[7, 11, 4, 1],
					],
				},
			},
			{
				source: 1,
				combine: false,
				points: [5, 7],
				off: false,
				plans: { "5": [[1, 5, 4, 1]], "7": [[1, 7, 6, 0]] },
			},
			{
				source: 12,
				combine: true,
				points: [16, 18, 22],
				off: false,
				plans: {
					"16": [[12, 16, 4, 1]],
					"18": [[12, 18, 6, 0]],
					"22": [
						[12, 18, 6, 0],
						[18, 22, 4, 1],
					],
				},
			},
			{
				source: 12,
				combine: false,
				points: [16, 18],
				off: false,
				plans: { "16": [[12, 16, 4, 1]], "18": [[12, 18, 6, 0]] },
			},
			{
				source: 17,
				combine: true,
				points: [21, 23],
				off: false,
				plans: { "21": [[17, 21, 4, 1]], "23": [[17, 23, 6, 0]] },
			},
			{
				source: 17,
				combine: false,
				points: [21, 23],
				off: false,
				plans: { "21": [[17, 21, 4, 1]], "23": [[17, 23, 6, 0]] },
			},
			{
				source: 19,
				combine: true,
				points: [23],
				off: false,
				plans: { "23": [[19, 23, 4, 1]] },
			},
			{
				source: 19,
				combine: false,
				points: [23],
				off: false,
				plans: { "23": [[19, 23, 4, 1]] },
			},
		],
	},
	{
		name: "doubles",
		spec: { dice: [2, 2, 2, 2] },
		rows: [
			{
				source: 13,
				combine: true,
				points: [9, 11],
				off: false,
				plans: {
					"9": [
						[13, 11, 2, 0],
						[11, 9, 2, 1],
					],
					"11": [[13, 11, 2, 0]],
				},
			},
			{
				source: 13,
				combine: false,
				points: [11],
				off: false,
				plans: { "11": [[13, 11, 2, 0]] },
			},
			{
				source: 6,
				combine: true,
				points: [2, 4],
				off: false,
				plans: {
					"2": [
						[6, 4, 2, 0],
						[4, 2, 2, 1],
					],
					"4": [[6, 4, 2, 0]],
				},
			},
			{
				source: 6,
				combine: false,
				points: [4],
				off: false,
				plans: { "4": [[6, 4, 2, 0]] },
			},
		],
	},
	{
		name: "one die already used",
		spec: { dice: [5, 3], used: [true, false] },
		rows: [
			{
				source: 13,
				combine: true,
				points: [10],
				off: false,
				plans: { "10": [[13, 10, 3, 1]] },
			},
			{
				source: 13,
				combine: false,
				points: [10],
				off: false,
				plans: { "10": [[13, 10, 3, 1]] },
			},
			{
				source: 8,
				combine: true,
				points: [5],
				off: false,
				plans: { "5": [[8, 5, 3, 1]] },
			},
			{
				source: 8,
				combine: false,
				points: [5],
				off: false,
				plans: { "5": [[8, 5, 3, 1]] },
			},
		],
	},
	{
		name: "first step blocked, other order open",
		spec: {
			points: { "8": ["white", 1], "10": ["black", 2], "13": ["white", 2] },
			dice: [3, 5],
		},
		rows: [
			{
				source: 13,
				combine: true,
				points: [5, 8],
				off: false,
				plans: {
					"5": [
						[13, 8, 5, 1],
						[8, 5, 3, 0],
					],
					"8": [[13, 8, 5, 1]],
				},
			},
			{
				source: 13,
				combine: false,
				points: [8],
				off: false,
				plans: { "8": [[13, 8, 5, 1]] },
			},
		],
	},
	{
		name: "both steps blocked",
		spec: {
			points: {
				"5": ["black", 2],
				"8": ["black", 2],
				"10": ["black", 2],
				"13": ["white", 2],
			},
			dice: [3, 5],
		},
		rows: [
			{ source: 13, combine: true, points: [], off: false, plans: {} },
			{ source: 13, combine: false, points: [], off: false, plans: {} },
		],
	},
	{
		name: "second step lands on a blot",
		spec: {
			points: { "7": ["black", 1], "10": ["black", 1], "13": ["white", 2] },
			dice: [3, 3, 3, 3],
		},
		rows: [
			{
				source: 13,
				combine: true,
				points: [7, 10],
				off: false,
				plans: {
					"7": [
						[13, 10, 3, 0],
						[10, 7, 3, 1],
					],
					"10": [[13, 10, 3, 0]],
				},
			},
			{
				source: 13,
				combine: false,
				points: [10],
				off: false,
				plans: { "10": [[13, 10, 3, 0]] },
			},
		],
	},
	{
		name: "bar must enter first",
		spec: { bar: { white: 1 }, dice: [6, 2] },
		rows: [
			{
				source: "bar",
				combine: true,
				points: [23],
				off: false,
				plans: { "23": [["bar", 23, 2, 1]] },
			},
			{
				source: "bar",
				combine: false,
				points: [23],
				off: false,
				plans: { "23": [["bar", 23, 2, 1]] },
			},
			{ source: 13, combine: true, points: [], off: false, plans: {} },
			{ source: 13, combine: false, points: [], off: false, plans: {} },
		],
	},
	{
		name: "bar entry blocked on one die",
		spec: {
			bar: { white: 1 },
			points: { "13": ["white", 2], "19": ["black", 2] },
			dice: [6, 2],
		},
		rows: [
			{
				source: "bar",
				combine: true,
				points: [17, 23],
				off: false,
				plans: {
					"17": [
						["bar", 23, 2, 1],
						[23, 17, 6, 0],
					],
					"23": [["bar", 23, 2, 1]],
				},
			},
			{
				source: "bar",
				combine: false,
				points: [23],
				off: false,
				plans: { "23": [["bar", 23, 2, 1]] },
			},
		],
	},
	{
		name: "bearing off",
		spec: {
			points: { "1": ["white", 1], "4": ["white", 3], "6": ["white", 2] },
			off: { white: 9 },
			dice: [6, 1],
		},
		rows: [
			{
				source: 6,
				combine: true,
				points: [5],
				off: true,
				plans: { "5": [[6, 5, 1, 1]], off: [[6, "off", 6, 0]] },
			},
			{
				source: 6,
				combine: false,
				points: [5],
				off: true,
				plans: { "5": [[6, 5, 1, 1]], off: [[6, "off", 6, 0]] },
			},
			{
				source: 4,
				combine: true,
				points: [3],
				off: true,
				plans: { "3": [[4, 3, 1, 1]], off: [[4, "off", 6, 0]] },
			},
			{
				source: 4,
				combine: false,
				points: [3],
				off: true,
				plans: { "3": [[4, 3, 1, 1]], off: [[4, "off", 6, 0]] },
			},
			{
				source: 1,
				combine: true,
				points: [],
				off: true,
				plans: { off: [[1, "off", 6, 0]] },
			},
			{
				source: 1,
				combine: false,
				points: [],
				off: true,
				plans: { off: [[1, "off", 6, 0]] },
			},
		],
	},
	{
		name: "bearing off with a straggler",
		spec: { points: { "4": ["white", 3], "7": ["white", 1] }, dice: [6, 1] },
		rows: [
			{
				source: 7,
				combine: true,
				points: [1, 6],
				off: true,
				plans: {
					"1": [[7, 1, 6, 0]],
					"6": [[7, 6, 1, 1]],
					off: [
						[7, 1, 6, 0],
						[1, "off", 1, 1],
					],
				},
			},
			{
				source: 7,
				combine: false,
				points: [1, 6],
				off: false,
				plans: { "1": [[7, 1, 6, 0]], "6": [[7, 6, 1, 1]] },
			},
			{
				source: 4,
				combine: true,
				points: [3],
				off: false,
				plans: { "3": [[4, 3, 1, 1]] },
			},
			{
				source: 4,
				combine: false,
				points: [3],
				off: false,
				plans: { "3": [[4, 3, 1, 1]] },
			},
		],
	},
	{
		name: "second step bears off once the straggler is home",
		spec: {
			points: { "3": ["white", 2], "7": ["white", 1] },
			off: { white: 12 },
			dice: [1, 6],
		},
		rows: [
			{
				source: 7,
				combine: true,
				points: [1, 6],
				off: true,
				plans: {
					"1": [[7, 1, 6, 1]],
					"6": [[7, 6, 1, 0]],
					off: [
						[7, 6, 1, 0],
						[6, "off", 6, 1],
					],
				},
			},
			{
				source: 7,
				combine: false,
				points: [1, 6],
				off: false,
				plans: { "1": [[7, 1, 6, 1]], "6": [[7, 6, 1, 0]] },
			},
		],
	},
	{
		name: "black bears off",
		spec: {
			active: "black",
			points: { "20": ["black", 2], "24": ["black", 2] },
			off: { black: 11 },
			dice: [5, 1],
		},
		rows: [
			{
				source: 24,
				combine: true,
				points: [],
				off: true,
				plans: { off: [[24, "off", 5, 0]] },
			},
			{
				source: 24,
				combine: false,
				points: [],
				off: true,
				plans: { off: [[24, "off", 5, 0]] },
			},
			{
				source: 20,
				combine: true,
				points: [21],
				off: true,
				plans: { "21": [[20, 21, 1, 1]], off: [[20, "off", 5, 0]] },
			},
			{
				source: 20,
				combine: false,
				points: [21],
				off: true,
				plans: { "21": [[20, 21, 1, 1]], off: [[20, "off", 5, 0]] },
			},
		],
	},
];

type TraversalSpec = {
	points?: Record<string, (BackgammonColor | number)[]>;
	dice: number[];
	used?: boolean[];
	bar?: Partial<Record<BackgammonColor, number>>;
	off?: Partial<Record<BackgammonColor, number>>;
	active?: BackgammonColor;
};

type TraversalCase = {
	name: string;
	spec: TraversalSpec;
	rows: Array<{
		source: number | "bar";
		combine: boolean;
		points: number[];
		off: boolean;
		plans: Record<string, (number | string)[][]>;
	}>;
};

function traversalState(spec: TraversalSpec): BackgammonTurnState {
	const opening = createInitialBackgammonState().points;
	return {
		points: spec.points
			? opening.map(({ point }) => {
					const entry = spec.points?.[point];
					return entry
						? {
								point,
								color: entry[0] as BackgammonColor,
								count: entry[1] as number,
							}
						: { point, count: 0 };
				})
			: opening,
		bar: { white: 0, black: 0, ...spec.bar },
		off: { white: 0, black: 0, ...spec.off },
		activeColor: spec.active ?? "white",
		dice: spec.dice,
		used: spec.used ?? spec.dice.map(() => false),
	};
}

describe("move traversal", () => {
	const destinations = [
		"off" as const,
		...Array.from({ length: 24 }, (_, index) => index + 1),
	];
	for (const { name, spec, rows } of TRAVERSAL_TABLE) {
		it(name, () => {
			const state = traversalState(spec);
			for (const { source, combine, points, off, plans } of rows) {
				const highlights = getMoveHighlights(state, source, combine);
				expect([...highlights.points].sort((a, b) => a - b)).toEqual(points);
				expect(highlights.off).toBe(off);
				for (const destination of destinations) {
					const plan = planBackgammonMove(state, source, destination, combine);
					expect(
						plan?.steps.map((step) => [
							step.from,
							step.to,
							step.die,
							step.dieIndex,
						]),
					).toEqual(plans[String(destination)]);
				}
			}
		});
	}

	it("throws for an unowned source once it looks at combined moves", () => {
		const state = withDice(createInitialBackgammonState(), [3, 1]);
		expect(() => getMoveHighlights(state, 7, true)).toThrow(
			"choosePointWithChecker",
		);
		expect(getMoveHighlights(state, 7, false).points.size).toBeGreaterThan(0);
		expect(planBackgammonMove(state, 7, 4, true)).toBeNull();
	});
});

describe("isTurnSpent", () => {
	const initial = createInitialBackgammonState();

	it("is true once every rolled die is used", () => {
		expect(isTurnSpent(withDice(initial, [3, 1], [true, true]))).toBe(true);
		expect(isTurnSpent(withDice(initial, [3, 1], [true, false]))).toBe(false);
	});

	it("is false before rolling", () => {
		expect(isTurnSpent(initial)).toBe(false);
	});

	it("is false after the winning move, so the game ends without a turn change", () => {
		const won = {
			...withDice(initial, [3, 1], [true, true]),
			off: { white: 15, black: 0 },
		};
		expect(isTurnSpent(won)).toBe(false);
	});
});

describe("online turn helpers", () => {
	const start = createInitialBackgammonState();

	it("reads which dice are used from the stored die values", () => {
		const { used, ...stored } = withDice(start, [6, 6, 6, 6]);
		expect(toTurnState({ ...stored, usedDice: [6, 6] })).toEqual({
			...stored,
			used: [true, true, false, false],
		});
	});

	it("ends the turn for the player only when asked and every die is spent", () => {
		const spent = withDice(start, [3, 1], [true, true]);
		expect(shouldAutoEndTurn(spent, true)).toBe(true);
		expect(shouldAutoEndTurn(spent, false)).toBe(false);
		expect(
			shouldAutoEndTurn(withDice(start, [3, 1], [true, false]), true),
		).toBe(false);
	});
});
