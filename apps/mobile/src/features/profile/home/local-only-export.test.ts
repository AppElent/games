import { newLocalMatch } from "@arcadeclub/core/backgammon-local";
import {
	remove,
	STORAGE_KEYS,
	writeJson,
	writeText,
} from "../../../storage/local-store";
import { writeLocalMatch } from "../../backgammon/local/local-match-store";
import { readLocalOnlyExport } from "./local-only-export";

describe("local-only export", () => {
	beforeEach(() => {
		remove(STORAGE_KEYS.displayName);
		remove(STORAGE_KEYS.backgammonLocal);
		writeText(STORAGE_KEYS.seats, "[]");
		writeJson(STORAGE_KEYS.guest, { id: "guest-secret", displayName: "G" });
	});

	it("is empty on a phone that kept nothing", () => {
		expect(readLocalOnlyExport(null)).toEqual({
			displayName: null,
			backgammon: null,
			seats: [],
			sudoku: [],
		});
	});

	it("adds the typed name, the backgammon match and the seats", () => {
		writeText(STORAGE_KEYS.displayName, " Eric ");
		const match = newLocalMatch(5);
		writeLocalMatch(match);
		writeJson(STORAGE_KEYS.seats, [
			{
				sessionId: "s1",
				participantId: "p1",
				gameType: "hitster",
				joinedAt: 3,
				seatSecret: "seat-secret",
			},
		]);

		const data = readLocalOnlyExport(null);
		expect(data.displayName).toBe("Eric");
		expect(data.backgammon).toEqual(match);
		expect(data.seats).toEqual([
			{
				sessionId: "s1",
				participantId: "p1",
				gameType: "hitster",
				joinedAt: 3,
			},
		]);
	});

	it("never holds the guest id or a seat secret", () => {
		writeJson(STORAGE_KEYS.seats, [
			{
				sessionId: "s1",
				participantId: "p1",
				gameType: "hitster",
				joinedAt: 3,
				seatSecret: "seat-secret",
			},
		]);
		const file = JSON.stringify(readLocalOnlyExport(null));
		expect(file).not.toContain("guest-secret");
		expect(file).not.toContain("seat-secret");
	});
});
