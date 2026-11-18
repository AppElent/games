/**
 * Keeps the site files and the app's link config in step, and the link
 * validators in step with the links invites actually carry. From the shared
 * app-links standard's `app-links.test.ts`, with Arcade Club's values.
 * `apps/mobile/src/lib/app-links-config.test.ts` checks `app.config.ts`.
 */
import fs from "node:fs";
import { buildInviteUrl, JOIN_CODE_ALPHABET } from "@arcadeclub/core/sessions";
import { describe, expect, it } from "vitest";
import {
	APP_LINK_APP_IDS,
	APP_LINK_HOST,
	APP_LINKS,
	buildAasa,
	iosAssociatedDomains,
	appLinks as links,
} from "../apps/mobile/src/lib/app-links.ts";
import { makeJoinCode, makeShareToken } from "../convex/lib/codes.ts";

const HOST = APP_LINK_HOST;
const AASA = "public/.well-known/apple-app-site-association";
const TOKEN = `share_${"0123456789abcdef".repeat(2)}`;
const CODE = "ABC234";

describe("site files", () => {
	it("serves the config's apple-app-site-association", () => {
		expect(JSON.parse(fs.readFileSync(AASA, "utf8"))).toEqual(
			buildAasa(APP_LINK_APP_IDS, APP_LINKS),
		);
	});

	it("serves it as application/json", () => {
		expect(fs.readFileSync("public/_headers", "utf8")).toMatch(
			/^\/\.well-known\/apple-app-site-association\n\s+Content-Type: application\/json$/m,
		);
	});
});

describe("link routing", () => {
	it.each([
		`https://${HOST}/join?token=${TOKEN}`,
		`https://${HOST}/join/?token=${TOKEN}`,
		`https://${HOST}/join?token=${TOKEN}&utm=x`,
		`https://${HOST}/join?token=${TOKEN}#top`,
		`arcadeclub://join?token=${TOKEN}`,
		`arcadeclub-preview:///join?token=${TOKEN}`,
		`arcadeclub-dev://join?token=${TOKEN}`,
		`/join?token=${TOKEN}`,
		`https://Arcade-Club.Appelent.NL/join?token=${TOKEN}`,
		`ArcadeClub://join?token=${TOKEN}`,
	])("opens %s", (url) => {
		expect(links.routeFromUrl(url)).toBe(`/join?token=${TOKEN}`);
		expect(links.systemPath(url)).toBe(`/join?token=${TOKEN}`);
	});

	it.each([
		`https://${HOST}:444/join?token=${TOKEN}`,
		`http://${HOST}/join?token=${TOKEN}`,
		`https://evil.example/join?token=${TOKEN}`,
		`https://www.${HOST}/join?token=${TOKEN}`,
		`https://${HOST}.evil.example/join?token=${TOKEN}`,
		`https://user@${HOST}/join?token=${TOKEN}`,
		`https://${HOST}/Join?token=${TOKEN}`,
		`https://${HOST}/join/extra?token=${TOKEN}`,
		`https://${HOST}/play`,
		"arcadeclub://join/extra",
		"arcadeclub://join//",
	])("sends %s home", (url) => {
		expect(links.routeFromUrl(url)).toBeNull();
		expect(links.systemPath(url)).toBe("/");
	});

	it.each([
		[`https://${HOST}/join?code=${CODE}`, `/join?code=${CODE}`],
		[`https://${HOST}/join?code=${CODE}&utm=x`, `/join?code=${CODE}`],
		[
			`https://${HOST}/join?token=${TOKEN}&code=${CODE}`,
			`/join?token=${TOKEN}&code=${CODE}`,
		],
		[`https://${HOST}/join?code=${CODE}&token=nope`, `/join?code=${CODE}`],
		[`https://${HOST}/join?token=${TOKEN}&token=nope`, `/join?token=${TOKEN}`],
		[`https://${HOST}/join?token=nope&token=${TOKEN}`, "/join"],
		// Not what the server makes: lower case, 0/O and 1/I, wrong length.
		[`https://${HOST}/join?code=abc234`, "/join"],
		[`https://${HOST}/join?code=ABC230`, "/join"],
		[`https://${HOST}/join?code=ABC2345`, "/join"],
		[`https://${HOST}/join?token=${TOKEN.toUpperCase()}`, "/join"],
		[`https://${HOST}/join?token=${TOKEN}%22`, "/join"],
		[`https://${HOST}/join?token=%E0%A4%A`, "/join"],
		[`https://${HOST}/join`, "/join"],
		["arcadeclub://join", "/join"],
	])("keeps only valid query keys of %s", (url, route) => {
		expect(links.systemPath(url)).toBe(route);
	});

	it("adds associated domains only to variants that claim links", () => {
		expect(iosAssociatedDomains(HOST, true)).toEqual({
			associatedDomains: [`applinks:${HOST}`, `webcredentials:${HOST}`],
		});
		expect(iosAssociatedDomains(HOST, false)).not.toHaveProperty(
			"associatedDomains",
		);
	});

	it("rebuilds the join route from the router's search params", () => {
		expect(
			links.routeFromPathname("/join", { token: [TOKEN, "XYZ"], other: "1" }),
		).toBe(`/join?token=${TOKEN}`);
	});

	it("passes other app-scheme links and plain launches through", () => {
		for (const url of [
			"arcadeclub://sso-callback?code=1",
			"arcadeclub-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081",
			"exp+arcadeclub://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081",
			"arcadeclub://scan",
			// What Expo Router hands over on a launch without a link.
			"arcadeclub:///",
			"arcadeclub://",
			"/",
		]) {
			expect(links.systemPath(url)).toBe(url);
		}
	});
});

describe("links invites carry", () => {
	it("opens every share token and room code the server makes", () => {
		for (let index = 0; index < 200; index += 1) {
			const token = makeShareToken();
			const code = makeJoinCode();
			expect(
				links.systemPath(buildInviteUrl(`https://${HOST}`, { token })),
			).toBe(`/join?token=${token}`);
			expect(
				links.systemPath(buildInviteUrl(`https://${HOST}`, { code })),
			).toBe(`/join?code=${code}`);
		}
	});

	it("accepts every room-code letter and no other", () => {
		const code =
			APP_LINKS[0] && "query" in APP_LINKS[0] ? APP_LINKS[0].query.code : null;
		for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
			expect(code?.test(letter.repeat(6))).toBe(
				JOIN_CODE_ALPHABET.includes(letter),
			);
		}
	});
});
