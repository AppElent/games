/**
 * New account: email + password (+ first name, which other players see),
 * then a 6-digit email code, then `finalize()`. The `signUp` resource
 * survives the push from the sign-up screen to the verify screen.
 */
import { useSignUp as useClerkSignUp } from "@clerk/expo";
import { useCallback, useState } from "react";
import { pickClerkErrorKey } from "./clerk-errors";

export function useSignUp() {
	const { signUp, errors } = useClerkSignUp();
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<unknown>(null);

	const create = useCallback(
		async (input: {
			email: string;
			password: string;
			firstName: string;
		}): Promise<boolean> => {
			setBusy(true);
			setReturned(null);
			const created = await signUp.password({
				emailAddress: input.email.trim(),
				password: input.password,
				firstName: input.firstName.trim() || undefined,
			});
			if (created.error) {
				setReturned(created.error);
				setBusy(false);
				return false;
			}
			const sent = await signUp.verifications.sendEmailCode();
			setBusy(false);
			if (sent.error) {
				setReturned(sent.error);
				return false;
			}
			return true;
		},
		[signUp],
	);

	const verify = useCallback(
		async (code: string) => {
			setBusy(true);
			setReturned(null);
			const verified = await signUp.verifications.verifyEmailCode({ code });
			if (verified.error) {
				setReturned(verified.error);
				setBusy(false);
				return;
			}
			const finalized = await signUp.finalize();
			if (finalized.error) {
				setReturned(finalized.error);
				setBusy(false);
			}
		},
		[signUp],
	);

	const resend = useCallback(async () => {
		setReturned(null);
		const sent = await signUp.verifications.sendEmailCode();
		if (sent.error) setReturned(sent.error);
		return !sent.error;
	}, [signUp]);

	return {
		create,
		verify,
		resend,
		busy,
		errorKey: returned ? pickClerkErrorKey(errors, returned) : null,
	};
}
