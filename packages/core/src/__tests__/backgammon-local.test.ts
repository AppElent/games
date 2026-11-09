import { describe, expect, it } from "vitest";
import {
	createInitialBackgammonState,
	planBackgammonMove,
} from "../backgammon";
import {
	DEFAULT_BACKGAMMON_OPTIONS,
	type LocalMatch,
	newLocalMatch,
	parseLocalMatch,
	reduceLocalMatch,
} from "../backgammon-local";

function rolled(match: LocalMatch, dice: number[]) {
	return reduceLocalMatch(match, { type: "roll", dice }, 1);
}

function move(match: LocalMatch, from: number, to: number, dice = [6, 6]) {
	const plan = planBackgammonMove(match.state, from, to, false);
	if (!plan) throw new Error(`no plan ${from}->${to}`);
	return reduceLocalMatch(match, { type: "move", plan, dice }, 2);
}

describe("local backgammon match", () => {
	it("rolls once per turn", () => {
		const match = rolled(newLocalMatch(0), [3, 1]);
		expect(match.state.dice).toEqual([3, 1]);
		expect(match.state.used).toEqual([false, false]);
		expect(rolled(match, [6, 5])).toBe(match);
	});

	it("passes the turn after the last die when auto-switch is on", () => {
		let match = rolled(newLocalMatch(0), [3, 1]);
		match = move(match, 8, 5);
		expect(match.state.activeColor).toBe("white");
		match = move(match, 6, 5);
		expect(match.state.activeColor).toBe("black");
		expect(match.state.dice).toEqual([]);
		expect(match.history).toHaveLength(2);
	});

	it("keeps the turn after the last die when auto-switch is off", () => {
		let match = newLocalMatch(0, {
			...DEFAULT_BACKGAMMON_OPTIONS,
			autoSwitchTurn: false,
		});
		match = rolled(match, [3, 1]);
		match = move(match, 8, 5);
		match = move(match, 6, 5);
		expect(match.state.activeColor).toBe("white");
		expect(match.state.used).toEqual([true, true]);
	});

	it("rolls for the next player when auto-roll is on", () => {
		let match = newLocalMatch(0, {
			...DEFAULT_BACKGAMMON_OPTIONS,
			autoRoll: true,
		});
		match = rolled(match, [3, 1]);
		match = move(match, 8, 5, [4, 2]);
		match = move(match, 6, 5, [4, 2]);
		expect(match.state.activeColor).toBe("black");
		expect(match.state.dice).toEqual([4, 2]);
	});

	it("rolls when auto-roll is switched on with no dice out", () => {
		const match = newLocalMatch(0);
		const on = reduceLocalMatch(
			match,
			{ type: "setOption", key: "autoRoll", value: true, dice: [5, 2] },
			1,
		);
		expect(on.options.autoRoll).toBe(true);
		expect(on.state.dice).toEqual([5, 2]);
		const other = reduceLocalMatch(
			match,
			{ type: "setOption", key: "showNumbers", value: false, dice: [5, 2] },
			1,
		);
		expect(other.options.showNumbers).toBe(false);
		expect(other.state.dice).toEqual([]);
	});

	it("undoes and redoes moves", () => {
		const start = rolled(newLocalMatch(0), [3, 1]);
		const moved = move(start, 8, 5);
		const undone = reduceLocalMatch(moved, { type: "undo" }, 3);
		expect(undone.state).toEqual(start.state);
		const redone = reduceLocalMatch(undone, { type: "redo" }, 4);
		expect(redone.state).toEqual(moved.state);
		expect(redone.future).toHaveLength(0);
	});

	it("keeps the last 60 moves", () => {
		const state = createInitialBackgammonState();
		const full: LocalMatch = {
			...rolled(newLocalMatch(0), [3, 1]),
			history: new Array(60).fill(state),
		};
		expect(move(full, 8, 5).history).toHaveLength(60);
	});

	it("ends a turn only once no die can be played", () => {
		const match = newLocalMatch(0);
		expect(reduceLocalMatch(match, { type: "endTurn", dice: [] }, 1)).toBe(
			match,
		);
		const playable = rolled(match, [6, 6]);
		expect(reduceLocalMatch(playable, { type: "endTurn", dice: [] }, 2)).toBe(
			playable,
		);
		const spent = {
			...playable,
			state: { ...playable.state, used: [true, true, true, true] },
		};
		const ended = reduceLocalMatch(spent, { type: "endTurn", dice: [] }, 3);
		expect(ended.state.activeColor).toBe("black");
	});

	it("stops after the winning move", () => {
		const match: LocalMatch = {
			...rolled(newLocalMatch(0), [1, 2]),
			state: {
				points: createInitialBackgammonState().points.map(({ point }) =>
					point === 1
						? { point, color: "white" as const, count: 1 }
						: { point, count: 0 },
				),
				bar: { white: 0, black: 0 },
				off: { white: 14, black: 0 },
				activeColor: "white",
				dice: [1],
				used: [false],
			},
		};
		const plan = planBackgammonMove(match.state, 1, "off", false);
		if (!plan) throw new Error("no plan");
		const won = reduceLocalMatch(match, { type: "move", plan, dice: [] }, 5);
		expect(won.state.off.white).toBe(15);
		expect(won.state.activeColor).toBe("white");
		expect(rolled(won, [3, 1])).toBe(won);
		expect(reduceLocalMatch(won, { type: "move", plan, dice: [] }, 6)).toBe(
			won,
		);
	});
});

describe("parseLocalMatch", () => {
	const state = createInitialBackgammonState();
	const saved = { state, history: [state], future: [], updatedAt: 5 };

	it("reads a save written by the mobile app", () => {
		const options = { ...DEFAULT_BACKGAMMON_OPTIONS, autoRoll: true };
		expect(parseLocalMatch(JSON.stringify({ ...saved, options }))).toEqual({
			...saved,
			options,
		});
	});

	it("reads a save written by the web app, which may lack newer options", () => {
		const options = {
			showNumbers: false,
			autoSwitchTurn: true,
			autoCombine: false,
		};
		expect(parseLocalMatch(JSON.stringify({ ...saved, options }))).toEqual({
			...saved,
			options: { ...options, autoRoll: false },
		});
	});

	it("rejects anything else", () => {
		for (const raw of [
			"not json",
			"null",
			"{}",
			JSON.stringify({ ...saved, state: { points: [] } }),
			JSON.stringify({ ...saved, history: undefined }),
			JSON.stringify({ ...saved, future: "none" }),
		]) {
			expect(parseLocalMatch(raw)).toBeNull();
		}
	});

	it("rejects a save whose turn the screens could not read", () => {
		const broken = [
			{ ...saved, state: { ...state, bar: undefined } },
			{ ...saved, state: { ...state, off: { white: 0 } } },
			{ ...saved, state: { ...state, activeColor: "red" } },
			{ ...saved, state: { ...state, dice: undefined } },
			{ ...saved, state: { ...state, used: null } },
			{ ...saved, updatedAt: "yesterday" },
		];
		for (const save of broken) {
			expect(parseLocalMatch(JSON.stringify(save))).toBeNull();
		}
	});
});
