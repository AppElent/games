/**
 * The state every Clerk flow shares: `busy` while a request runs and the
 * translated key of the last failure. Clerk Core 3 calls resolve to
 * `{ error }` instead of throwing, so a flow is a list of calls run in turn
 * until one of them returns an error.
 *
 * Contract for every auth hook: hooks never navigate. A flow that ends in a
 * session ends with Clerk's `finalize()`, which flips `isSignedIn`; the
 * `(auth)` layout closes the modal on that flip, returning the player to
 * whatever asked for an account. That is why `finish` leaves `busy` on after
 * success: the screen is about to close.
 */
import { useCallback, useState } from "react";
import { type ClerkErrorSignal, pickClerkErrorKey } from "./clerk-errors";

/**
 * One Clerk call. Resolving to `null` stops the flow without an error, for
 * a state this app does not handle, which the hook reports its own way.
 */
type Step = () => Promise<{ error: unknown } | null>;

export function useAuthFlow(errors: ClerkErrorSignal | null | undefined) {
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<unknown>(null);

	/** Runs the steps in turn; true when every one succeeded. */
	const call = useCallback(async (...steps: Step[]): Promise<boolean> => {
		setReturned(null);
		for (const step of steps) {
			const result = await step();
			if (!result) return false;
			if (result.error) {
				setReturned(result.error);
				return false;
			}
		}
		return true;
	}, []);

	/** `call`, busy until the last step returns. */
	const send = useCallback(
		async (...steps: Step[]) => {
			setBusy(true);
			const done = await call(...steps);
			setBusy(false);
			return done;
		},
		[call],
	);

	/** `call` for steps that end in `finalize()`: busy stays on after success. */
	const finish = useCallback(
		async (...steps: Step[]) => {
			setBusy(true);
			const done = await call(...steps);
			if (!done) setBusy(false);
			return done;
		},
		[call],
	);

	return {
		call,
		send,
		finish,
		busy,
		errorKey: returned ? pickClerkErrorKey(errors, returned) : null,
	};
}
