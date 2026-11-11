import { describe, expect, it } from "vitest";
import { FEATURES } from "../features";
import { GAME_TYPES } from "../games";

describe("feature list", () => {
	it("lists every game as a product feature on the web", () => {
		for (const game of GAME_TYPES) {
			const feature = FEATURES.find(({ id }) => id === game);
			expect(feature, game).toMatchObject({ kind: "product" });
			expect(feature?.platforms, game).toContain("web");
		}
	});
});
