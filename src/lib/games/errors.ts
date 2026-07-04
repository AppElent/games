import { ConvexError } from "convex/values";

/**
 * Turn a caught error into a message safe to show to users.
 * ConvexError data is written for users; anything else falls back so raw
 * server dumps ("[CONVEX M(...)] Server Error ...") never reach the UI.
 */
export function getUserErrorMessage(caught: unknown, fallback: string) {
	if (caught instanceof ConvexError) {
		return typeof caught.data === "string" ? caught.data : fallback;
	}
	if (
		caught instanceof Error &&
		caught.message &&
		!caught.message.includes("[CONVEX")
	) {
		return caught.message;
	}
	return fallback;
}
