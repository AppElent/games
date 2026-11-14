/** How a share ended: the sheet took it, the person closed it, or the browser could not share. */
export type ShareOutcome = "shared" | "cancelled" | "unavailable";

type ShareNavigator = Pick<Navigator, "share" | "canShare">;

/** Whether this browser has a share sheet (most phones do, most desktops do not). */
export function canShareLinks(
	nav: Partial<ShareNavigator> | undefined = typeof navigator === "undefined"
		? undefined
		: navigator,
) {
	return typeof nav?.share === "function";
}

/**
 * Opens the device's share sheet with a link. Call it straight from the tap,
 * before any other await, so the browser still sees the user's gesture.
 */
export async function shareLink(
	url: string,
	title: string,
	nav: Partial<ShareNavigator> | undefined = typeof navigator === "undefined"
		? undefined
		: navigator,
): Promise<ShareOutcome> {
	const data = { title, url };
	if (!nav?.share || !(nav.canShare?.(data) ?? true)) {
		return "unavailable";
	}
	try {
		await nav.share(data);
		return "shared";
	} catch (error) {
		return error instanceof Error && error.name === "AbortError"
			? "cancelled"
			: "unavailable";
	}
}
