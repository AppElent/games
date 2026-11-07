import { newLocalMatch } from "@arcadeclub/core/backgammon-local";
import {
	clearLocalMatch,
	readLocalMatch,
	writeLocalMatch,
} from "./local-match-store";

describe("local match store", () => {
	it("persists the match", () => {
		const match = newLocalMatch(1);
		writeLocalMatch(match);
		expect(readLocalMatch()).toEqual(match);
		clearLocalMatch();
		expect(readLocalMatch()).toBeNull();
	});
});
