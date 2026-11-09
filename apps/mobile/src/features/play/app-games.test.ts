import { GAME_TYPES } from "@arcadeclub/core/games";
import { isOnlineAppGame, onlineSessionHref } from "./app-games";

describe("app games", () => {
	it("opens every online game on a screen for that session", () => {
		const online = GAME_TYPES.filter(isOnlineAppGame);
		expect(online.length).toBeGreaterThan(0);
		for (const gameType of online) {
			expect(onlineSessionHref(gameType, "s1")).toMatchObject({
				params: { sessionId: "s1" },
			});
		}
	});
});
