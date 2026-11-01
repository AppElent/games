import { describe, expect, it } from "vitest";
import {
	buildShareUrl,
	formatJoinCode,
	getGuestDisplayName,
	isJoinCodeLike,
	normalizeJoinCode,
	parseInvite,
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
		expect(getGuestDisplayName("guest_9876", "Speler {number}")).toBe(
			"Speler 876",
		);
	});

	it("builds share urls without duplicate slashes", () => {
		expect(buildShareUrl("https://games.test/", "share_abc")).toBe(
			"https://games.test/join?token=share_abc",
		);
	});

	it("reads invites from QR codes and links", () => {
		expect(parseInvite("https://games.example/join?token=ab%2Fc")).toEqual({
			token: "ab/c",
		});
		expect(parseInvite("arcadeclub-dev://join?code=abc-123")).toEqual({
			code: "ABC123",
		});
		expect(
			parseInvite("https://games.example/join/?code=ABC123&token=t1#x"),
		).toEqual({ token: "t1" });
		expect(parseInvite(" abc 123 ")).toEqual({ code: "ABC123" });
	});

	it("rejects QR codes that are not invites", () => {
		expect(parseInvite("https://example.com/?code=ABC123")).toBeNull();
		expect(parseInvite("https://games.example/join?code=X")).toBeNull();
		expect(parseInvite("https://games.example/join")).toBeNull();
		expect(parseInvite("WIFI:S:home;T:WPA;P:secret;;")).toBeNull();
		expect(parseInvite("hello world, long text")).toBeNull();
	});
});
