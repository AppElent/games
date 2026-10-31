import { createInitialBackgammonState } from "@games/core/backgammon";
import { turnHint } from "./turn-hint";

const opening = createInitialBackgammonState();
const rolled = { ...opening, dice: [3, 1], used: [false, false] };

describe("turn hint", () => {
	it("walks a turn from roll to done", () => {
		expect(turnHint(opening, null)).toBe("rollPrompt");
		expect(turnHint(rolled, null)).toBe("pickChecker");
		expect(turnHint(rolled, 8)).toBe("pickTarget");
		expect(turnHint({ ...rolled, used: [true, true] }, null)).toBe("turnDone");
	});

	it("asks for the bar checker first", () => {
		expect(turnHint({ ...rolled, bar: { white: 1, black: 0 } }, "bar")).toBe(
			"enterFromBar",
		);
	});

	it("says nothing once the game is won", () => {
		expect(
			turnHint({ ...rolled, off: { white: 15, black: 0 } }, null),
		).toBeNull();
	});
});
