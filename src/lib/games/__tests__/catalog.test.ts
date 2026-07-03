import { describe, expect, it } from "vitest";
import {
	GAME_CATALOG,
	getGameByType,
	getPlayableGames,
	getVisibleGames,
} from "../catalog";

describe("game catalog", () => {
	it("lists live quiz, backgammon, sudoku and hitster as playable games", () => {
		expect(getPlayableGames().map((game) => game.type)).toEqual([
			"live-quiz",
			"backgammon",
			"sudoku",
			"hitster",
		]);
	});

	it("keeps future games visible but not playable", () => {
		const visibleTypes = getVisibleGames().map((game) => game.type);
		expect(visibleTypes).toContain("chess");
		expect(visibleTypes).toContain("word-games");
		expect(
			getVisibleGames()
				.filter((game) => game.availability !== "playable")
				.map((game) => game.availability),
		).toEqual(["coming-soon", "coming-soon"]);
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
