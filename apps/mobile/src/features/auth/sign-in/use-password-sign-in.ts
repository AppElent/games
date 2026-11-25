/**
 * Email + password, all the way to an active session or to the second step.
 *
 * Clerk Core 3 trap: a successful `signIn.password()` leaves the sign-in
 * `complete` but not active; `finalize()` promotes it.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback } from "react";
import { useSignInFlow } from "../components/use-sign-in-flow";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const { finishSignIn, busy, errorKey, unsupported } = useSignInFlow(
		signIn,
		errors,
	);

	/** Resolves to `"secondFactor"` when the account wants one first. */
	const submit = useCallback(
		(email: string, password: string) =>
			finishSignIn(() =>
				signIn.password({ identifier: email.trim(), password }),
			),
		[finishSignIn, signIn],
	);

	return { submit, busy, unsupported, errorKey };
}
