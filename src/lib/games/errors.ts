import { gameErrorMessage } from "@arcadeclub/core/errors";
import { useCallback } from "react";
import { useMessages } from "#/lib/i18n";

/**
 * Turn a caught error into text safe to show to users. Keyed server and
 * rule errors are localized from `messages.serverErrors`; anything else
 * (network failures, "[CONVEX M(...)] Server Error" dumps) shows `fallback`.
 */
export function useErrorMessage() {
	const messages = useMessages();
	return useCallback(
		(caught: unknown, fallback: string) =>
			gameErrorMessage(messages, caught, fallback),
		[messages],
	);
}
