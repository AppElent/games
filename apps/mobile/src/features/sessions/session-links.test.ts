import { GAME_TYPES } from "@arcadeclub/core/games";
import { hasAppScreen } from "./session-links";

describe("session links", () => {
	it("opens only online backgammon and Hitster in the app", () => {
		expect(GAME_TYPES.filter(hasAppScreen)).toEqual(["backgammon", "hitster"]);
	});
});
