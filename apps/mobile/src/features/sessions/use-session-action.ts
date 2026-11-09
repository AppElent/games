/**
 * The shape of every call to a session's backend: busy while it runs, the last
 * failure in `error`, and the failure haptic. `run` resolves to the action's
 * result, or `null` when it failed.
 */
import { useCallback, useState } from "react";
import { haptics } from "../../feedback/haptics";

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
