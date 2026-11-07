import { GAME_TYPES } from "@arcadeclub/core/games";
import { messages } from "@arcadeclub/core/messages";
import { describe, expect, it } from "vitest";
import { getGameByType, getLocalizedGame, getVisibleGames } from "../catalog";

describe("game catalog", () => {
	it("lists the core games", () => {
		const visibleTypes = getVisibleGames().map((game) => game.type);
		expect(visibleTypes).toEqual([...GAME_TYPES]);
	});

	it("uses room mode for quiz and challenge mode for backgammon", () => {
		expect(getGameByType("live-quiz")?.joinMode).toBe("room");
		expect(getGameByType("backgammon")?.joinMode).toBe("challenge");
	});

	it("has stable unique game types", () => {
		const types = getVisibleGames().map((game) => game.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it("overlays the display text of the viewer's language", () => {
		for (const game of getVisibleGames()) {
			expect(getLocalizedGame(game, messages.nl)).toEqual({
				...game,
				...messages.nl.catalog[game.type],
			});
		}
		const sudoku = getGameByType("sudoku");
		expect(sudoku && getLocalizedGame(sudoku, messages.en).title).toBe(
			"Sudoku",
		);
	});
});
