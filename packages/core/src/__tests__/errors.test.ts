import { describe, expect, it } from "vitest";
import { GameRuleError, gameErrorMessage } from "../errors";
import { messages } from "../messages";

describe("gameErrorMessage", () => {
	it("localizes a ConvexError-shaped keyed error", () => {
		const caught = Object.assign(new Error("x"), {
			data: { code: "notYourTurn" },
		});
		expect(gameErrorMessage(messages.nl, caught, "fallback")).toBe(
			messages.nl.serverErrors.notYourTurn,
		);
	});

	it("localizes a shared-rule error", () => {
		expect(
			gameErrorMessage(messages.en, new GameRuleError("columnFull"), "x"),
		).toBe(messages.en.serverErrors.columnFull);
	});

	it("falls back for anything without a known code", () => {
		expect(
			gameErrorMessage(messages.en, new Error("[CONVEX M] boom"), "f"),
		).toBe("f");
		expect(gameErrorMessage(messages.en, { data: { code: "nope" } }, "f")).toBe(
			"f",
		);
		expect(gameErrorMessage(messages.en, null, "f")).toBe("f");
	});
});
