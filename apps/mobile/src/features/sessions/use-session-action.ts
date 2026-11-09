/**
 * The shape of every call to a session's backend: busy while it runs, the last
 * failure in `error`, and the failure haptic. `run` resolves to the action's
 * result, or `null` when it failed. A game error (a keyed `ConvexError`, such
 * as a full room or an illegal move) is expected and only shown; anything
 * else is also reported.
 */
import { gameErrorData } from "@arcadeclub/core/errors";
import { useCallback, useState } from "react";
import { haptics } from "../../feedback/haptics";
import { reportError } from "../../observability/report";

export function useSessionAction() {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const run = useCallback(
		async <T>(action: () => Promise<T>): Promise<T | null> => {
			setBusy(true);
			setError(null);
			try {
				return await action();
			} catch (caught) {
				haptics.actionFailed();
				if (!gameErrorData(caught)) reportError(caught);
				setError(caught);
				return null;
			} finally {
				setBusy(false);
			}
		},
		[],
	);

	return { run, busy, error };
}
