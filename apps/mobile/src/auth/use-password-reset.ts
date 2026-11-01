/**
 * Forgotten password, Core 3: `signIn.create({ identifier })` names the
 * account, `resetPasswordEmailCode.sendCode()` mails the code, a correct code
 * moves the sign-in to `needs_new_password`, and `submitPassword` plus
 * `finalize()` signs the person in with the new password.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { pickClerkErrorKey } from "./clerk-errors";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<unknown>(null);

	const sendCode = useCallback(
		async (email: string): Promise<boolean> => {
			setBusy(true);
			setReturned(null);
			const created = await signIn.create({ identifier: email.trim() });
			if (created.error) {
				setReturned(created.error);
				setBusy(false);
				return false;
			}
			const sent = await signIn.resetPasswordEmailCode.sendCode();
			setBusy(false);
			if (sent.error) {
				setReturned(sent.error);
				return false;
			}
			return true;
		},
		[signIn],
	);

	const submit = useCallback(
		async (code: string, password: string) => {
			setBusy(true);
			setReturned(null);
			const verified = await signIn.resetPasswordEmailCode.verifyCode({
				code,
			});
			if (verified.error) {
				setReturned(verified.error);
				setBusy(false);
				return;
			}
			const saved = await signIn.resetPasswordEmailCode.submitPassword({
				password,
			});
			if (saved.error) {
				setReturned(saved.error);
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
		sendCode,
		submit,
		busy,
		errorKey: returned ? pickClerkErrorKey(errors, returned) : null,
	};
}
