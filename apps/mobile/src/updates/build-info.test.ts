import { messages } from "@arcadeclub/core/messages";
import { buildInfoLine, otaLabel } from "./build-info";

const nl = messages.nl.profile;
const en = messages.en.profile;
const SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
// 20 Nov 2026, 10:12 in Amsterdam.
const PUBLISHED = new Date("2026-11-20T09:12:00Z");
const base = {
	version: "1.0.0",
	build: "23",
	channel: "preview",
	updateCreatedAt: PUBLISHED,
	sha: SHA,
};

describe("buildInfoLine", () => {
	it("shows version, build, update label and channel for an OTA update", () => {
		expect(buildInfoLine(base, nl)).toBe(
			"Versie 1.0.0 (23) · update 1.0.0 · 20 nov · a1b2c3d · preview",
		);
	});

	it("says geen update on the embedded bundle", () => {
		expect(buildInfoLine({ ...base, updateCreatedAt: null }, nl)).toBe(
			"Versie 1.0.0 (23) · geen update · preview",
		);
	});

	it("says geen update when the update's commit is unknown", () => {
		expect(buildInfoLine({ ...base, sha: undefined }, nl)).toBe(
			"Versie 1.0.0 (23) · geen update · preview",
		);
		expect(buildInfoLine({ ...base, sha: "not-a-sha" }, nl)).toBe(
			"Versie 1.0.0 (23) · geen update · preview",
		);
	});

	it("leaves out the build number and the channel when unknown", () => {
		expect(
			buildInfoLine(
				{ ...base, build: null, channel: null, updateCreatedAt: null },
				nl,
			),
		).toBe("Versie 1.0.0 · geen update");
	});

	it("reads in English too", () => {
		expect(buildInfoLine(base, en)).toBe(
			"Version 1.0.0 (23) · update 1.0.0 · 20 nov · a1b2c3d · preview",
		);
		expect(buildInfoLine({ ...base, updateCreatedAt: null }, en)).toBe(
			"Version 1.0.0 (23) · no update · preview",
		);
	});
});

describe("otaLabel", () => {
	it("uses the Amsterdam calendar day of the publish time", () => {
		// 23:30 UTC on 30 Nov is already 1 Dec in Amsterdam.
		expect(
			otaLabel({ ...base, updateCreatedAt: new Date("2026-11-30T23:30:00Z") }),
		).toBe("1.0.0 · 1 dec · a1b2c3d");
	});
});
