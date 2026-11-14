import { describe, expect, it, vi } from "vitest";
import { canShareLinks, shareLink } from "#/lib/share-link";

const URL = "https://arcade.example/join/ABC123";

function failing(name: string) {
	return vi.fn(async () => {
		const error = new Error(name);
		error.name = name;
		throw error;
	});
}

describe("shareLink", () => {
	it("hands the link to the share sheet when there is one", async () => {
		const share = vi.fn(async () => undefined);
		await expect(shareLink(URL, "Invite players", { share })).resolves.toBe(
			"shared",
		);
		expect(share).toHaveBeenCalledWith({ title: "Invite players", url: URL });
	});

	it("is unavailable without a share sheet", async () => {
		await expect(shareLink(URL, "Invite", {})).resolves.toBe("unavailable");
		await expect(shareLink(URL, "Invite", undefined)).resolves.toBe(
			"unavailable",
		);
		expect(canShareLinks({})).toBe(false);
		expect(canShareLinks({ share: async () => undefined })).toBe(true);
	});

	it("is unavailable when the browser cannot share this link", async () => {
		const share = vi.fn(async () => undefined);
		await expect(
			shareLink(URL, "Invite", { share, canShare: () => false }),
		).resolves.toBe("unavailable");
		expect(share).not.toHaveBeenCalled();
	});

	it("is unavailable when the sheet refuses", async () => {
		await expect(
			shareLink(URL, "Invite", { share: failing("NotAllowedError") }),
		).resolves.toBe("unavailable");
	});

	it("tells a closed sheet apart from a failure", async () => {
		await expect(
			shareLink(URL, "Invite", { share: failing("AbortError") }),
		).resolves.toBe("cancelled");
	});
});
