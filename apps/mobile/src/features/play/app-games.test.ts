import { FEATURES, type Feature } from "@arcadeclub/core/features";
import { GAME_TYPES } from "@arcadeclub/core/games";
import { APP_GAMES, isOnlineAppGame, onlineSessionHref } from "./app-games";

describe("app games", () => {
	it("carries exactly the games the feature list puts on mobile", () => {
		const features: readonly Feature[] = FEATURES;
		const games = new Set<string>(GAME_TYPES);
		const onMobile = features
			.filter(
				({ id, platforms }) => games.has(id) && platforms.includes("mobile"),
			)
			.map(({ id }) => id);
		expect(Object.keys(APP_GAMES).sort()).toEqual(onMobile.sort());
	});

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
