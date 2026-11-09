/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 * `send` runs on the sign-in screen and `verify`/`resend` on the code screen,
 * each with its own instance of this hook: Clerk's `signIn` resource survives
 * the navigation in between, so the code screen continues the attempt the
 * sign-in screen started.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useAuthFlow } from "../components/use-auth-flow";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const flow = useAuthFlow(errors);
	const { call, send: request, finish } = flow;
	const [resending, setResending] = useState(false);

	const send = useCallback(
		(email: string) =>
			request(() => signIn.emailCode.sendCode({ emailAddress: email.trim() })),
		[request, signIn],
	);

	const resend = useCallback(async (): Promise<boolean> => {
		if (resending) return false;
		setResending(true);
		const sent = await call(() => signIn.emailCode.sendCode());
		setResending(false);
		return sent;
	}, [call, signIn, resending]);

	/** Clears the attempt; makes no request. */
	const startOver = useCallback(async () => {
		await call(() => signIn.reset());
	}, [call, signIn]);

	const verify = useCallback(
		async (code: string) => {
			await finish(
				() => signIn.emailCode.verifyCode({ code }),
				() => signIn.finalize(),
			);
		},
		[finish, signIn],
	);

	return {
		send,
		resend,
		resending,
		startOver,
		verify,
		busy: flow.busy,
		errorKey: flow.errorKey,
	};
}
