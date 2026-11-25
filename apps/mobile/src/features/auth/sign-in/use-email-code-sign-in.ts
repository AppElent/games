/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 * `send` runs on the sign-in screen and `verify`/`resend` on the code screen,
 * each with its own instance of this hook: Clerk's `signIn` resource survives
 * the navigation in between, so the code screen continues the attempt the
 * sign-in screen started.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useSignInFlow } from "../components/use-sign-in-flow";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const flow = useSignInFlow(signIn, errors);
	const { call, send: request, finishSignIn } = flow;
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

	/** Resolves to `"secondFactor"` when the account wants one first. */
	const verify = useCallback(
		(code: string) => finishSignIn(() => signIn.emailCode.verifyCode({ code })),
		[finishSignIn, signIn],
	);

	return {
		send,
		resend,
		resending,
		startOver,
		verify,
		busy: flow.busy,
		unsupported: flow.unsupported,
		error: flow.error,
	};
}
