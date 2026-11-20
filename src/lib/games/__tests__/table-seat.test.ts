import { isSeatSecret } from "@arcadeclub/core/sessions";
import { describe, expect, it } from "vitest";
import { newTableSeatSecret } from "#/lib/games/table-seat";

describe("newTableSeatSecret", () => {
	it("makes the shape the server takes, a fresh one each time", () => {
		const secret = newTableSeatSecret();
		expect(isSeatSecret(secret)).toBe(true);
		expect(newTableSeatSecret()).not.toBe(secret);
	});
});
