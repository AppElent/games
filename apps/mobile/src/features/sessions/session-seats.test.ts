import type { Id } from "../../convex/api";
import { readText, STORAGE_KEYS, writeText } from "../../storage/local-store";
import {
	findSeat,
	forgetSeat,
	listSeats,
	rememberSeat,
	resumableItems,
} from "./session-seats";

const sessionId = "s1" as Id<"gameSessions">;
const participantId = "p1" as Id<"sessionParticipants">;

describe("session seats", () => {
	beforeEach(() => writeText(STORAGE_KEYS.seats, "[]"));

	it("remembers and forgets a seat", () => {
		rememberSeat({ sessionId, participantId, gameType: "hitster" });
		expect(findSeat("s1")).toMatchObject({
			participantId,
			gameType: "hitster",
		});
		forgetSeat("s1");
		expect(findSeat("s1")).toBeUndefined();
	});

	it("keeps the stored shape", () => {
		jest.spyOn(Date, "now").mockReturnValue(7);
		rememberSeat({ sessionId, participantId, gameType: "hitster" });
		jest.restoreAllMocks();
		expect(readText(STORAGE_KEYS.seats)).toBe(
			'[{"sessionId":"s1","participantId":"p1","gameType":"hitster","joinedAt":7}]',
		);
	});

	it("drops bad entries and keeps the good ones, newest first", () => {
		const seat = { sessionId: "a", participantId: "pa", gameType: "chess" };
		writeText(
			STORAGE_KEYS.seats,
			JSON.stringify([
				{ ...seat, joinedAt: 1 },
				{ ...seat, sessionId: "b", joinedAt: 2 },
				{ ...seat, sessionId: "no-time" },
				{ ...seat, sessionId: "bad-game", gameType: "tetris", joinedAt: 3 },
				{ sessionId: "no-participant", gameType: "chess", joinedAt: 4 },
				null,
			]),
		);
		expect(listSeats().map((item) => item.sessionId)).toEqual(["b", "a"]);
	});

	it.each(["{not json", "12", '{"sessionId":"s1"}'])(
		"reads %s as no seats",
		(raw) => {
			writeText(STORAGE_KEYS.seats, raw);
			expect(listSeats()).toEqual([]);
			expect(resumableItems()).toEqual([]);
		},
	);
});
