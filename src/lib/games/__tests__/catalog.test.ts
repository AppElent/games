import { readFileSync } from "node:fs";
import {
	GAME_SESSION_POLICY,
	GAME_TYPES,
	type SessionGameType,
} from "@arcadeclub/core/games";
import { messages } from "@arcadeclub/core/messages";
import { describe, expect, it } from "vitest";
import {
	getGameByType,
	getHostPath,
	getLocalizedGame,
	getSessionPath,
	getVisibleGames,
} from "../catalog";

/** Every page the router serves, as `/chess/$sessionId`-style patterns. */
const ROUTES = (() => {
	const tree = readFileSync(
		new URL("../../../routeTree.gen.ts", import.meta.url),
		"utf8",
	);
	const fullPaths = tree.match(/fullPaths:([^;]*?)fileRoutesByTo/s)?.[1] ?? "";
	return [...fullPaths.matchAll(/'([^']+)'/g)].map(([, path]) =>
		path.length > 1 ? path.replace(/\/$/, "") : path,
	);
})();

function isRoute(href: string) {
	const segments = href.split("?")[0].split("/");
	return ROUTES.some((route) => {
		const pattern = route.split("/");
		return (
			pattern.length === segments.length &&
			pattern.every(
				(part, index) => part.startsWith("$") || part === segments[index],
			)
		);
	});
}

describe("game catalog", () => {
	it("lists every game", () => {
		const visibleTypes = getVisibleGames().map((game) => game.type);
		expect(visibleTypes).toEqual([...GAME_TYPES]);
	});

	it("starts every game on a page that exists", () => {
		expect(ROUTES.length).toBeGreaterThan(0);
		for (const game of getVisibleGames()) {
			expect(isRoute(game.route), game.route).toBe(true);
		}
	});

	it("sends joiners and hosts of every session game to a page that exists", () => {
		for (const game of getVisibleGames()) {
			const joined = getSessionPath(game.type, "s1", "p1");
			const hosted = getHostPath(game.type, "s1", "p1");
			const othersJoin =
				game.type in GAME_SESSION_POLICY &&
				GAME_SESSION_POLICY[game.type as SessionGameType].joinMode !== "solo";
			if (othersJoin) {
				expect(joined, game.type).not.toBeNull();
			}
			for (const path of [joined, hosted]) {
				if (path !== null) expect(isRoute(path), path).toBe(true);
			}
		}
	});

	it("carries the player's seat into room games that play on a second page", () => {
		expect(getSessionPath("live-quiz", "s1", "p1")).toBe(
			"/quiz/s1/play?participantId=p1",
		);
		expect(getHostPath("live-quiz", "s1", "p1")).toBe("/quiz/s1/host");
		expect(getHostPath("chess", "s1", "p1")).toBe(
			getSessionPath("chess", "s1", "p1"),
		);
	});

	it("shows each game's text in the viewer's language", () => {
		const chess = getGameByType("chess");
		if (!chess) throw new Error("chess is missing from the catalog");
		expect(getLocalizedGame(chess, messages.en)).toMatchObject({
			type: "chess",
			route: "/chess/new",
			title: "Chess",
		});
		expect(getLocalizedGame(chess, messages.nl).title).toBe("Schaken");
	});
});
