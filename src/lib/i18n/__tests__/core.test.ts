import { describe, expect, it } from "vitest";
import { fmt, isLocale, plural, resolveLocale } from "../core";

describe("isLocale", () => {
	it("accepts supported locales", () => {
		expect(isLocale("en")).toBe(true);
		expect(isLocale("nl")).toBe(true);
	});

	it("rejects everything else", () => {
		expect(isLocale("de")).toBe(false);
		expect(isLocale("")).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe("resolveLocale", () => {
	it("prefers a valid cookie over everything", () => {
		expect(resolveLocale("nl", "en-US")).toBe("nl");
		expect(resolveLocale("en", "nl-NL")).toBe("en");
	});

	it("ignores an invalid cookie", () => {
		expect(resolveLocale("de", "nl")).toBe("nl");
	});

	it("matches Accept-Language variants in order", () => {
		expect(resolveLocale(undefined, "nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
		expect(resolveLocale(undefined, "nl-BE")).toBe("nl");
		expect(resolveLocale(undefined, "fr-FR,en-GB;q=0.8")).toBe("en");
	});

	it("falls back to en", () => {
		expect(resolveLocale(undefined, undefined)).toBe("en");
		expect(resolveLocale(undefined, "de-DE,fr;q=0.9")).toBe("en");
	});
});

describe("fmt", () => {
	it("replaces placeholders", () => {
		expect(fmt("Hello {name}!", { name: "Eric" })).toBe("Hello Eric!");
		expect(fmt("{a} vs {b}", { a: 1, b: 2 })).toBe("1 vs 2");
	});

	it("leaves unknown placeholders intact", () => {
		expect(fmt("Hi {name}", {})).toBe("Hi {name}");
	});

	it("replaces repeated placeholders", () => {
		expect(fmt("{x} and {x}", { x: "y" })).toBe("y and y");
	});
});

describe("plural", () => {
	it("selects the singular form at 1", () => {
		expect(
			plural("en", 1, { one: "{count} player", other: "{count} players" }),
		).toBe("1 player");
		expect(
			plural("nl", 1, { one: "{count} speler", other: "{count} spelers" }),
		).toBe("1 speler");
	});

	it("selects the plural form otherwise", () => {
		expect(
			plural("en", 0, { one: "{count} player", other: "{count} players" }),
		).toBe("0 players");
		expect(
			plural("nl", 4, { one: "{count} speler", other: "{count} spelers" }),
		).toBe("4 spelers");
	});
});
