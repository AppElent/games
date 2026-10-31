/**
 * Email + password, all the way to an active session.
 *
 * Clerk Core 3 trap: a successful `signIn.password()` leaves the sign-in
 * `complete` but not active; `finalize()` promotes it. Nothing here
 * navigates: the auth screens close themselves once `isSignedIn` flips, so
 * `busy` is only cleared on failure paths.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { pickClerkErrorKey } from "./clerk-errors";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<unknown>(null);
	const [unsupported, setUnsupported] = useState(false);

	const submit = useCallback(
		async (email: string, password: string) => {
			setBusy(true);
			setReturned(null);
			setUnsupported(false);
			const attempt = await signIn.password({
				identifier: email.trim(),
				password,
			});
			if (attempt.error) {
				setReturned(attempt.error);
				setBusy(false);
				return;
			}
			if (signIn.status !== "complete") {
				setUnsupported(true);
				setBusy(false);
				return;
			}
			const finalized = await signIn.finalize();
			if (finalized.error) {
				setReturned(finalized.error);
				setBusy(false);
			}
		},
		[signIn],
	);

	return {
		submit,
		busy,
		unsupported,
		errorKey: returned ? pickClerkErrorKey(errors, returned) : null,
	};
}
