import { describe, expect, it } from "vitest";
import { FEATURES, type Platform } from "../features";
import { GAME_TYPES } from "../games";

// Web-only games waiting for triage (APP-49). This list may shrink, never grow:
// a new game ships on web and mobile at once (docs/adr/0002).
const WEB_ONLY_BACKLOG = [
	"live-quiz",
	"chess",
	"word-links",
	"connect-four",
	"signal-words",
	"bluff-dice",
	"squad-surge",
];

describe("feature list", () => {
	it("lists every game as a product feature on the web", () => {
		for (const game of GAME_TYPES) {
			const feature = FEATURES.find(({ id }) => id === game);
			expect(feature, game).toMatchObject({ kind: "product" });
			expect(feature?.platforms, game).toContain("web");
		}
	});

	it("adds no new web-only game", () => {
		const webOnly = GAME_TYPES.filter((game) => {
			const platforms: readonly Platform[] =
				FEATURES.find(({ id }) => id === game)?.platforms ?? [];
			return !platforms.includes("mobile");
		});
		for (const game of webOnly) expect(WEB_ONLY_BACKLOG, game).toContain(game);
	});
});
