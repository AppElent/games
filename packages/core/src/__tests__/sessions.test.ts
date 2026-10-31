import { describe, expect, it } from "vitest";
import {
	buildShareUrl,
	formatJoinCode,
	getGuestDisplayName,
	isJoinCodeLike,
	normalizeJoinCode,
} from "../sessions";

describe("session helpers", () => {
	it("normalizes room codes to uppercase alphanumeric text", () => {
		expect(normalizeJoinCode(" ab-12 ")).toBe("AB12");
		expect(normalizeJoinCode("quiz 88")).toBe("QUIZ88");
	});

	it("formats long room codes for display", () => {
		expect(formatJoinCode("ABCD12")).toBe("ABC D12");
		expect(formatJoinCode("AB12")).toBe("AB12");
	});

	it("detects plausible join codes", () => {
		expect(isJoinCodeLike("ABC123")).toBe(true);
		expect(isJoinCodeLike("A")).toBe(false);
		expect(isJoinCodeLike("too-long-code")).toBe(false);
	});

	it("creates stable guest display names from ids", () => {
		expect(getGuestDisplayName("guest_0001")).toBe("Player 001");
		expect(getGuestDisplayName("guest_9876")).toBe("Player 876");
	});

	it("builds share urls without duplicate slashes", () => {
		expect(buildShareUrl("https://games.test/", "share_abc")).toBe(
			"https://games.test/join?token=share_abc",
		);
	});
});
