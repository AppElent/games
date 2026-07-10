import { describe, expect, it } from "vitest";
import {
	GAME_CATALOG,
	getGameByType,
	getPlayableGames,
	getVisibleGames,
} from "../catalog";

describe("game catalog", () => {
	it("lists the core games as playable", () => {
		const playable = getPlayableGames().map((game) => game.type);
		for (const type of [
			"live-quiz",
			"backgammon",
			"sudoku",
			"hitster",
			"word-links",
		]) {
			expect(playable).toContain(type);
		}
	});

	it("keeps every catalog entry visible", () => {
		const visibleTypes = getVisibleGames().map((game) => game.type);
		expect(visibleTypes).toContain("chess");
		expect(visibleTypes).toContain("word-links");
		expect(visibleTypes.length).toBe(GAME_CATALOG.length);
	});

	it("uses room mode for quiz and challenge mode for backgammon", () => {
		expect(getGameByType("live-quiz")?.joinMode).toBe("room");
		expect(getGameByType("backgammon")?.joinMode).toBe("challenge");
	});

	it("has stable unique game types", () => {
		const types = GAME_CATALOG.map((game) => game.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it("declares valid player counts for every game", () => {
		for (const game of GAME_CATALOG) {
			expect(game.minPlayers).toBeGreaterThanOrEqual(1);
			expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
		}
	});

	it("keeps solo games single-player without rematch or spectators", () => {
		for (const game of GAME_CATALOG.filter(
			(item) => item.joinMode === "solo",
		)) {
			expect(game.maxPlayers).toBe(1);
			expect(game.supportsSpectators).toBe(false);
		}
	});

	it("supports rematch and spectators on two-player challenge games", () => {
		for (const type of ["backgammon", "chess", "connect-four"] as const) {
			const game = getGameByType(type);
			expect(game?.minPlayers).toBe(2);
			expect(game?.maxPlayers).toBe(2);
			expect(game?.supportsRematch).toBe(true);
			expect(game?.supportsSpectators).toBe(true);
		}
	});

	it("marks guest support consistently with the auth policy", () => {
		for (const game of GAME_CATALOG) {
			if (game.authPolicy === "signedInRequired") {
				expect(game.supportsGuests).toBe(false);
			} else {
				expect(game.supportsGuests).toBe(true);
			}
		}
	});
});
