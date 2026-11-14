import { copyToClipboard } from "#/lib/use-copy-feedback";

/** How a share ended: the sheet took it, it fell back to the clipboard, or neither. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

type ShareNavigator = Pick<Navigator, "share" | "canShare">;

/**
 * Opens the device's share sheet with a link. Browsers without one (most
 * desktops) copy the link instead, as does a sheet that fails; a person
 * closing the sheet is not a failure and copies nothing.
 */
export async function shareLink(
	url: string,
	title: string,
	nav: Partial<ShareNavigator> = typeof navigator === "undefined"
		? {}
		: navigator,
): Promise<ShareOutcome> {
	const data = { title, url };
	if (typeof nav.share === "function" && (nav.canShare?.(data) ?? true)) {
		try {
			await nav.share(data);
			return "shared";
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return "cancelled";
			}
		}
	}
	return (await copyToClipboard(url)) ? "copied" : "failed";
}
