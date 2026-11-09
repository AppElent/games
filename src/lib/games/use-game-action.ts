import { useCallback, useState } from "react";
import { useErrorMessage } from "#/lib/games/errors";

/** One error slot for a screen's mutations, shown in the viewer's language. */
export function useGameAction() {
	const errorMessage = useErrorMessage();
	const [error, setError] = useState("");

	/** Resolves true when `action` succeeded; a failure lands in `error`. */
	const run = useCallback(
		async (action: () => Promise<unknown>, fallback: string) => {
			setError("");
			try {
				await action();
				return true;
			} catch (caught) {
				setError(errorMessage(caught, fallback));
				return false;
			}
		},
		[errorMessage],
	);

	return { error, setError, run };
}
