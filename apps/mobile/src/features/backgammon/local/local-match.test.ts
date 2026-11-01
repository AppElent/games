import { planBackgammonMove } from "@arcadeclub/core/backgammon";
import {
	DEFAULT_BACKGAMMON_OPTIONS,
	type LocalMatch,
	newLocalMatch,
	reduceLocalMatch,
} from "./local-match";
import {
	clearLocalMatch,
	readLocalMatch,
	writeLocalMatch,
} from "./local-match-store";

function rolled(match: LocalMatch, dice: number[]) {
	return reduceLocalMatch(match, { type: "roll" }, dice, 1);
}

function move(match: LocalMatch, from: number, to: number, next = [6, 6]) {
	const plan = planBackgammonMove(match.state, from, to, false);
	if (!plan) throw new Error(`no plan ${from}->${to}`);
	return reduceLocalMatch(match, { type: "move", plan }, next, 2);
}

describe("local backgammon match", () => {
	it("rolls once per turn", () => {
		const match = rolled(newLocalMatch(), [3, 1]);
		expect(match.state.dice).toEqual([3, 1]);
		expect(rolled(match, [6, 5])).toBe(match);
	});

	it("passes the turn after the last die when auto-switch is on", () => {
		let match = rolled(newLocalMatch(), [3, 1]);
		match = move(match, 8, 5);
		expect(match.state.activeColor).toBe("white");
		match = move(match, 6, 5);
		expect(match.state.activeColor).toBe("black");
		expect(match.state.dice).toEqual([]);
		expect(match.history).toHaveLength(2);
	});

	it("rolls for the next player when auto-roll is on", () => {
		let match = newLocalMatch({
			...DEFAULT_BACKGAMMON_OPTIONS,
			autoRoll: true,
		});
		match = rolled(match, [3, 1]);
		match = move(match, 8, 5, [4, 2]);
		match = move(match, 6, 5, [4, 2]);
		expect(match.state.activeColor).toBe("black");
		expect(match.state.dice).toEqual([4, 2]);
	});

	it("undoes and redoes moves", () => {
		const start = rolled(newLocalMatch(), [3, 1]);
		const moved = move(start, 8, 5);
		const undone = reduceLocalMatch(moved, { type: "undo" }, [], 3);
		expect(undone.state).toEqual(start.state);
		const redone = reduceLocalMatch(undone, { type: "redo" }, [], 4);
		expect(redone.state).toEqual(moved.state);
		expect(redone.future).toHaveLength(0);
	});

	it("ends a turn only once no die can be played", () => {
		const match = newLocalMatch();
		expect(reduceLocalMatch(match, { type: "endTurn" }, [], 1)).toBe(match);
		const playable = rolled(match, [6, 6]);
		expect(reduceLocalMatch(playable, { type: "endTurn" }, [], 2)).toBe(
			playable,
		);
		const spent = {
			...playable,
			state: { ...playable.state, used: [true, true, true, true] },
		};
		const ended = reduceLocalMatch(spent, { type: "endTurn" }, [], 3);
		expect(ended.state.activeColor).toBe("black");
	});

	it("persists the match", () => {
		const match = rolled(newLocalMatch(), [3, 1]);
		writeLocalMatch(match);
		expect(readLocalMatch()).toEqual(match);
		clearLocalMatch();
		expect(readLocalMatch()).toBeNull();
	});
});
