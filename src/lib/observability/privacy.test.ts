import type { Event } from "@sentry/react";
import { describe, expect, it } from "vitest";
import { isLocalSentryUrl } from "./config";
import {
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
} from "./privacy";

describe("isLocalSentryUrl", () => {
	it("treats loopback hosts as local", () => {
		for (const url of [
			"http://localhost:3000/",
			"http://app.localhost/",
			"http://127.0.0.1:8787/",
			"http://[::1]:3000/",
			"http://0.0.0.0/",
		]) {
			expect(isLocalSentryUrl(url)).toBe(true);
		}
		expect(isLocalSentryUrl("https://games.appelent.workers.dev/")).toBe(false);
	});
});

describe("sanitizeEvent message", () => {
	it("filters tokens, emails and secret query values", () => {
		expect(
			sanitizeEvent({ message: "Bearer abc a@b.nl /join?token=xyz&x=1" })
				.message,
		).toBe("Bearer [Filtered] [Filtered] /join?token=[Filtered]&x=1");
	});
});

describe("sanitizeEvent", () => {
	it("keeps only the user id and the request path", () => {
		const event = sanitizeEvent({
			user: { id: "user_1", email: "a@b.nl" },
			request: {
				method: "GET",
				url: "https://games.appelent.workers.dev/join?token=abc",
				headers: { cookie: "x" },
			},
			extra: { payload: "secret" },
		} as Event);
		expect(event.user).toEqual({ id: "user_1" });
		expect(event.request).toEqual({
			method: "GET",
			url: "https://games.appelent.workers.dev/join",
		});
		expect(event.extra).toBeUndefined();
	});
});

describe("sanitizeBreadcrumb", () => {
	it("drops console output and query strings", () => {
		expect(sanitizeBreadcrumb({ category: "console", message: "x" })).toBe(
			null,
		);
		expect(
			sanitizeBreadcrumb({
				category: "navigation",
				data: { from: "/join?token=a", to: "/hitster/abc", body: "x" },
			})?.data,
		).toEqual({ from: "/join", to: "/hitster/abc" });
	});
});

describe("sanitizeFeedbackEvent", () => {
	it("redacts the typed report, which bypasses beforeSend", () => {
		const event = sanitizeFeedbackEvent({
			type: "feedback",
			contexts: {
				feedback: {
					message: "Stuck, mail me at a@b.nl",
					url: "https://games.appelent.workers.dev/join?token=abc",
					contact_email: "a@b.nl",
					name: "Ann",
				},
			},
		} as unknown as Event);
		expect(event.contexts?.feedback).toEqual({
			message: "Stuck, mail me at [Filtered]",
			url: "https://games.appelent.workers.dev/join",
		});
	});

	it("leaves error events to beforeSend", () => {
		const event = { message: "a@b.nl" } as Event;
		expect(sanitizeFeedbackEvent(event).message).toBe("a@b.nl");
	});
});
