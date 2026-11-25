/**
 * Forgotten password, Core 3: `signIn.create({ identifier })` names the
 * account, `resetPasswordEmailCode.sendCode()` mails the code, a correct code
 * moves the sign-in to `needs_new_password`, and `submitPassword` plus
 * `finalize()` signs the person in with the new password, after the second
 * step when the account has one.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback } from "react";
import { useSignInFlow } from "../components/use-sign-in-flow";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const flow = useSignInFlow(signIn, errors);
	const { send, finishSignIn } = flow;

	const sendCode = useCallback(
		(email: string) =>
			send(
				() => signIn.create({ identifier: email.trim() }),
				() => signIn.resetPasswordEmailCode.sendCode(),
			),
		[send, signIn],
	);

	const submit = useCallback(
		(code: string, password: string) =>
			finishSignIn(
				() => signIn.resetPasswordEmailCode.verifyCode({ code }),
				() => signIn.resetPasswordEmailCode.submitPassword({ password }),
			),
		[finishSignIn, signIn],
	);

	return {
		sendCode,
		submit,
		busy: flow.busy,
		unsupported: flow.unsupported,
		errorKey: flow.errorKey,
	};
}
