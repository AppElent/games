import { describe, expect, it } from "vitest";
import {
	authPageHref,
	returnTarget,
	safeReturnPath,
	shouldShowTestLogin,
	signInDestination,
} from "../core";

describe("shouldShowTestLogin", () => {
	it("is false on a live key even with creds present", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_live_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is false on a test key with no creds", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
			}),
		).toBe(false);
	});

	it("is false on a test key with only one of the two creds", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
			}),
		).toBe(false);
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is false with no publishable key at all", () => {
		expect(
			shouldShowTestLogin({
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(false);
	});

	it("is true only when both a test key and both creds are present", () => {
		expect(
			shouldShowTestLogin({
				VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x",
				VITE_TEST_USER_EMAIL: "test@test.com",
				VITE_TEST_USER_PASSWORD: "secret",
			}),
		).toBe(true);
	});
});

describe("safeReturnPath", () => {
	it("keeps an in-app path with its query", () => {
		expect(safeReturnPath("/account")).toBe("/account");
		expect(safeReturnPath("/sudoku/play?id=1")).toBe("/sudoku/play?id=1");
	});

	it("drops anything that could leave the site", () => {
		for (const value of [
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"/.//evil.example",
			"/a/..//evil.example",
			"javascript:alert(1)",
			"account",
			"/\taccount",
			"",
			undefined,
			42,
		]) {
			expect(safeReturnPath(value)).toBeUndefined();
		}
	});
});

describe("signInDestination", () => {
	it("returns to a checked in-app path, else the fallback", () => {
		expect(signInDestination("/account", "/dashboard")).toBe("/account");
		// What `useSearch` still holds when `validateSearch` dropped it.
		expect(signInDestination("//evil.example", "/dashboard")).toBe(
			"/dashboard",
		);
		expect(signInDestination(undefined, "/dashboard")).toBe("/dashboard");
	});
});

describe("signInDestination on an auth page (APP-596)", () => {
	it("never returns to a sign-in, sign-up or reset form", () => {
		for (const value of [
			"/sign-in",
			"/sign-in?redirect=%2Faccount",
			"/Sign-In/",
			"/%73ign-in",
			"/sign-up",
			"/forgot-password#x",
		]) {
			expect(signInDestination(value, "/dashboard")).toBe("/dashboard");
		}
		expect(signInDestination("/sign-in-tips", "/dashboard")).toBe(
			"/sign-in-tips",
		);
	});
});

describe("authPageHref", () => {
	it("carries a checked return path", () => {
		expect(authPageHref("/sign-in", "/sudoku/play?id=1")).toBe(
			"/sign-in?redirect=%2Fsudoku%2Fplay%3Fid%3D1",
		);
	});

	it("drops a return path that leaves the site or is an auth page", () => {
		expect(authPageHref("/sign-in", "//evil.example")).toBe("/sign-in");
		expect(authPageHref("/sign-up", "/sign-in")).toBe("/sign-up");
		expect(authPageHref("/sign-in", undefined)).toBe("/sign-in");
	});
});

describe("returnTarget", () => {
	it("returns to the page itself", () => {
		expect(returnTarget("/cards/toepen?mode=online")).toBe(
			"/cards/toepen?mode=online",
		);
	});

	it("passes on an auth page's own redirect", () => {
		expect(returnTarget("/sign-in?redirect=%2Faccount")).toBe("/account");
		expect(
			returnTarget("/sign-up?redirect=%2F%2Fevil.example"),
		).toBeUndefined();
		expect(returnTarget("/sign-up?redirect=%2Fsign-in")).toBeUndefined();
		expect(returnTarget("/forgot-password")).toBeUndefined();
	});
});
