import { messages } from "@arcadeclub/core/messages";
import type { ErrorEvent, Event } from "@sentry/react-native";
import {
	buildSentryOptions,
	environmentFromChannel,
	FEEDBACK_OPTIONS,
	feedbackLabels,
	routeName,
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
	shouldInitSentry,
} from "./options";

describe("shouldInitSentry", () => {
	it("needs a DSN and stays silent in development bundles", () => {
		expect(
			shouldInitSentry({ dsn: undefined, dev: false, debug: undefined }),
		).toBe(false);
		expect(shouldInitSentry({ dsn: "x", dev: true, debug: undefined })).toBe(
			false,
		);
		expect(shouldInitSentry({ dsn: "x", dev: true, debug: "1" })).toBe(true);
		expect(shouldInitSentry({ dsn: "x", dev: false, debug: undefined })).toBe(
			true,
		);
	});
});

describe("environmentFromChannel", () => {
	it("maps EAS channels to environments", () => {
		expect(environmentFromChannel("preview", false)).toBe("preview");
		expect(environmentFromChannel("production", false)).toBe("production");
		expect(environmentFromChannel(null, true)).toBe("development");
	});
});

describe("privacy", () => {
	it("sends no PII, tracing or replay", () => {
		const options = buildSentryOptions({ dsn: "x", environment: "production" });
		expect(options.sendDefaultPii).toBe(false);
		expect(options.enableAutoPerformanceTracing).toBe(false);
		expect(options.attachScreenshot).toBe(false);
	});

	it("drops the user and query strings from events", () => {
		const event = sanitizeEvent({
			type: undefined,
			user: { id: "u1", email: "a@b.c" },
			request: { url: "arcadeclub://join?token=secret", cookies: { a: "b" } },
		} as ErrorEvent);
		expect(event.user).toBeUndefined();
		expect(event.request).toEqual({ url: "arcadeclub://join" });
	});

	it("strips console arguments and URL queries from breadcrumbs", () => {
		expect(
			sanitizeBreadcrumb({
				category: "console",
				message: "m",
				data: { arguments: ["Ann"] },
			}),
		).toEqual({ category: "console", message: "m" });
		expect(
			sanitizeBreadcrumb({
				category: "fetch",
				data: { url: "https://x.dev/a?code=ABC" },
			})?.data,
		).toEqual({ url: "https://x.dev/a" });
	});

	it("names routes by pattern", () => {
		expect(routeName(["hitster", "[sessionId]"])).toBe("/hitster/[sessionId]");
	});
});

describe("feedback", () => {
	it("asks for no name or email and only a self-taken screenshot", () => {
		expect(FEEDBACK_OPTIONS).toMatchObject({
			enableShakeToReport: true,
			showName: false,
			showEmail: false,
			enableTakeScreenshot: true,
			showBranding: false,
		});
	});

	it("labels the form in the player's language", () => {
		expect(feedbackLabels(messages.nl.common.feedback)).toMatchObject({
			formTitle: "Probleem melden",
			removeScreenshotButtonLabel: "Screenshot verwijderen",
			isRequiredLabel: "(verplicht)",
		});
	});

	it("drops contact details, the user and the query from a report", () => {
		const event = {
			type: "feedback",
			user: { id: "user_1", email: "a@b.nl" },
			contexts: {
				feedback: {
					message: "The board froze",
					url: "arcadeclub://hitster/abc?token=secret",
					contact_email: "a@b.nl",
					name: "Ann",
				},
			},
		} as unknown as Event;
		const result = sanitizeFeedbackEvent(event);
		expect(result.user).toBeUndefined();
		expect(result.contexts?.feedback).toEqual({
			message: "The board froze",
			url: "arcadeclub://hitster/abc",
		});
	});

	it("leaves error events to beforeSend", () => {
		const event = { message: "x", user: { id: "1" } } as Event;
		expect(sanitizeFeedbackEvent(event)).toBe(event);
	});
});
