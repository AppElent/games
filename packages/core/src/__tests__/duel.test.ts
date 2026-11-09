import { describe, expect, it } from "vitest";
import { duelTurn, occupant, opponent, seatOf } from "../duel";

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

describe("duelTurn", () => {
	const full = {
		phase: "active",
		activeColor: "red" as const,
		redParticipantId: "p1",
		yellowParticipantId: "p2",
	};

	it("lets the seated player whose colour is active move", () => {
		expect(duelTurn(SEATS, full, "p1")).toEqual({ ok: true, seat: "red" });
	});

	it("blocks the other seat, a stranger and a tab with no seat", () => {
		expect(duelTurn(SEATS, full, "p2")).toEqual({
			ok: false,
			blocked: "notYourTurn",
		});
		expect(duelTurn(SEATS, full, "p3")).toEqual({
			ok: false,
			blocked: "notSeated",
		});
		expect(duelTurn(SEATS, full, undefined)).toEqual({
			ok: false,
			blocked: "notSeated",
		});
	});

	it("waits for the second seat before anyone moves", () => {
		const waiting = { ...full, yellowParticipantId: undefined };
		expect(duelTurn(SEATS, waiting, "p1")).toEqual({
			ok: false,
			blocked: "waitingForOpponent",
		});
	});

	it("blocks every move once the game is finished, first of all", () => {
		const finished = {
			...full,
			phase: "finished",
			yellowParticipantId: undefined,
		};
		expect(duelTurn(SEATS, finished, "p1")).toEqual({
			ok: false,
			blocked: "finished",
		});
	});
});
