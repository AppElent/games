import { GAME_TYPES } from "@arcadeclub/core/games";
import { hasAppScreen, onlineSessionHref } from "./session-links";

describe("session links", () => {
	it("opens only online backgammon and Hitster in the app", () => {
		expect(GAME_TYPES.filter(hasAppScreen)).toEqual(["backgammon", "hitster"]);
	});

	it("builds each game's session route", () => {
		expect(onlineSessionHref("backgammon", "abc")).toEqual({
			pathname: "/backgammon/online/[sessionId]",
			params: { sessionId: "abc" },
		});
		expect(onlineSessionHref("hitster", "abc")).toEqual({
			pathname: "/hitster/[sessionId]",
			params: { sessionId: "abc" },
		});
	});
});
