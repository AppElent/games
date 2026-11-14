// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink } from "#/lib/share-link";

const URL = "https://arcade.example/join/ABC123";

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: writeText ? { writeText } : undefined,
	});
}

function abort() {
	const error = new Error("closed");
	error.name = "AbortError";
	return error;
}

describe("shareLink", () => {
	afterEach(() => stubClipboard(null));

	it("hands the link to the share sheet when there is one", async () => {
		const share = vi.fn(async () => undefined);
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		await expect(shareLink(URL, "Invite players", { share })).resolves.toBe(
			"shared",
		);
		expect(share).toHaveBeenCalledWith({ title: "Invite players", url: URL });
		expect(writeText).not.toHaveBeenCalled();
	});

	it("copies the link when the browser has no share sheet", async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		await expect(shareLink(URL, "Invite", {})).resolves.toBe("copied");
		expect(writeText).toHaveBeenCalledWith(URL);
	});

	it("copies the link when the browser cannot share it", async () => {
		const share = vi.fn(async () => undefined);
		stubClipboard(async () => undefined);
		await expect(
			shareLink(URL, "Invite", { share, canShare: () => false }),
		).resolves.toBe("copied");
		expect(share).not.toHaveBeenCalled();
	});

	it("copies the link when the share sheet fails", async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		const share = vi.fn(async () => {
			throw new Error("NotAllowedError");
		});
		await expect(shareLink(URL, "Invite", { share })).resolves.toBe("copied");
		expect(writeText).toHaveBeenCalledWith(URL);
	});

	it("does nothing more when the person closes the sheet", async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		const share = vi.fn(async () => {
			throw abort();
		});
		await expect(shareLink(URL, "Invite", { share })).resolves.toBe(
			"cancelled",
		);
		expect(writeText).not.toHaveBeenCalled();
	});

	it("reports a failure when neither sharing nor copying works", async () => {
		stubClipboard(null);
		await expect(shareLink(URL, "Invite", {})).resolves.toBe("failed");
	});
});
