import { describe, expect, it } from "vitest";
import { dropRejectionMessage, joinDice } from "../backgammon-messages";
import { messages } from "../messages";

const en = messages.en.games.backgammon.board;
const nl = messages.nl.games.backgammon.board;

describe("joinDice", () => {
	it("joins with the locale's and", () => {
		expect(joinDice([5], "and")).toBe("5");
		expect(joinDice([5, 3], "and")).toBe("5 and 3");
		expect(joinDice([4, 4, 4], "en")).toBe("4, 4 en 4");
	});
});

describe("dropRejectionMessage", () => {
	const dice = { dice: [5, 3], used: [false, false] };

	it("names the remaining dice when the point is out of reach", () => {
		const reach = { kind: "reject", reason: "reach" } as const;
		expect(dropRejectionMessage(en, reach, dice)).toBe(
			"You can't move there with 5 and 3.",
		);
		expect(dropRejectionMessage(nl, reach, dice)).toBe(
			"Daar kun je niet heen met 5 en 3.",
		);
		expect(
			dropRejectionMessage(en, reach, { dice: [5, 3], used: [true, false] }),
		).toBe("You can't move there with 3.");
	});

	it("names the point when it is blocked", () => {
		const blocked = { kind: "reject", reason: "blocked", point: 12 } as const;
		expect(dropRejectionMessage(en, blocked, dice)).toBe(
			"Point 12 is blocked.",
		);
		expect(dropRejectionMessage(nl, blocked, dice)).toBe(
			"Punt 12 is geblokkeerd.",
		);
	});
});
