/**
 * Forgotten password, Core 3: `signIn.create({ identifier })` names the
 * account, `resetPasswordEmailCode.sendCode()` mails the code, a correct code
 * moves the sign-in to `needs_new_password`, and `submitPassword` plus
 * `finalize()` signs the person in with the new password.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback } from "react";
import { useAuthFlow } from "../components/use-auth-flow";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const flow = useAuthFlow(errors);
	const { send, finish } = flow;

	const sendCode = useCallback(
		(email: string) =>
			send(
				() => signIn.create({ identifier: email.trim() }),
				() => signIn.resetPasswordEmailCode.sendCode(),
			),
		[send, signIn],
	);

	const submit = useCallback(
		async (code: string, password: string) => {
			await finish(
				() => signIn.resetPasswordEmailCode.verifyCode({ code }),
				() => signIn.resetPasswordEmailCode.submitPassword({ password }),
				() => signIn.finalize(),
			);
		},
		[finish, signIn],
	);

	return {
		sendCode,
		submit,
		busy: flow.busy,
		errorKey: flow.errorKey,
	};
}
