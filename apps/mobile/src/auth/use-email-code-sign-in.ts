/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 * `send` runs on the sign-in screen and `verify`/`resend` on the code screen;
 * Clerk's `signIn` resource survives the navigation in between.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { pickClerkErrorKey } from "./clerk-errors";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState(false);
	const [resending, setResending] = useState(false);
	const [returned, setReturned] = useState<unknown>(null);

	const send = useCallback(
		async (email: string): Promise<boolean> => {
			setBusy(true);
			setReturned(null);
			const sent = await signIn.emailCode.sendCode({
				emailAddress: email.trim(),
			});
			setBusy(false);
			if (sent.error) {
				setReturned(sent.error);
				return false;
			}
			return true;
		},
		[signIn],
	);

	const resend = useCallback(async (): Promise<boolean> => {
		if (resending) return false;
		setResending(true);
		setReturned(null);
		const sent = await signIn.emailCode.sendCode();
		setResending(false);
		if (sent.error) {
			setReturned(sent.error);
			return false;
		}
		return true;
	}, [signIn, resending]);

	const startOver = useCallback(async () => {
		setReturned(null);
		await signIn.reset();
	}, [signIn]);

	const verify = useCallback(
		async (code: string) => {
			setBusy(true);
			setReturned(null);
			const verified = await signIn.emailCode.verifyCode({ code });
			if (verified.error) {
				setReturned(verified.error);
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
		send,
		resend,
		resending,
		startOver,
		verify,
		busy,
		errorKey: returned ? pickClerkErrorKey(errors, returned) : null,
	};
}
