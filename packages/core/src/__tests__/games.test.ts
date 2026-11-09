import { describe, expect, it } from "vitest";
import { GAME_TYPES, seatsCarrySecret } from "../games";

describe("seatsCarrySecret", () => {
	it("holds only for card tables, whose participant ids are public", () => {
		expect(GAME_TYPES.filter(seatsCarrySecret)).toEqual(["card-games"]);
	});
});
