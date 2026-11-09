import { describe, expect, it } from "vitest";
import { occupant, opponent, seatOf } from "../duel";

const SEATS = ["red", "yellow"] as const;

describe("duel seats", () => {
	const state = { redParticipantId: "p1", yellowParticipantId: undefined };

	it("reads who holds a seat from its column", () => {
		expect(occupant(state, "red")).toBe("p1");
		expect(occupant(state, "yellow")).toBeUndefined();
	});

	it("finds a participant's seat, and none for an empty or absent one", () => {
		expect(seatOf(SEATS, state, "p1")).toBe("red");
		expect(seatOf(SEATS, state, "p2")).toBeUndefined();
		expect(seatOf(SEATS, state, undefined)).toBeUndefined();
		expect(seatOf(SEATS, state, null)).toBeUndefined();
	});

	it("names the other seat", () => {
		expect(opponent(SEATS, "red")).toBe("yellow");
		expect(opponent(SEATS, "yellow")).toBe("red");
	});
});
