import {
	type BackgammonTurnState,
	createInitialBackgammonState,
	planBackgammonMove,
} from "@arcadeclub/core/backgammon";
import { moveHaptic } from "./move-haptic";

function rolled(dice: number[], state = createInitialBackgammonState()) {
	return { ...state, dice, used: dice.map(() => false) };
}

function plan(state: BackgammonTurnState, from: number, to: number | "off") {
	const result = planBackgammonMove(state, from, to, true);
	if (!result) throw new Error(`no plan ${from} → ${to}`);
	return result;
}

describe("moveHaptic", () => {
	it("is a plain move", () => {
		const state = rolled([5, 3]);
		expect(moveHaptic(state, plan(state, 8, 3))).toBe("moveMade");
	});

	it("is a hit when the move lands on a blot", () => {
		const base = createInitialBackgammonState();
		base.points[2] = { point: 3, color: "black", count: 1 };
		const state = rolled([5, 3], base);
		expect(moveHaptic(state, plan(state, 8, 3))).toBe("checkerHit");
	});

	it("is the win, not the move, for the last checker off", () => {
		const base = createInitialBackgammonState();
		const points = base.points.map((point) =>
			point.color === "white" ? { point: point.point, count: 0 } : point,
		);
		points[0] = { point: 1, color: "white", count: 1 };
		const state = rolled([6, 2], {
			...base,
			points,
			off: { white: 14, black: 0 },
		});
		expect(moveHaptic(state, plan(state, 1, "off"))).toBe("gameWon");
	});
});
