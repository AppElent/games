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
});
