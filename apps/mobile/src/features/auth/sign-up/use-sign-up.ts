/**
 * New account: email + password (+ first name, which other players see),
 * then a 6-digit email code, then `finalize()`. The sign-up and verify
 * screens each hold an instance of this hook; Clerk's `signUp` resource
 * survives the push from one to the other.
 */
import { useSignUp as useClerkSignUp } from "@clerk/expo";
import { useCallback } from "react";
import { useAuthFlow } from "../components/use-auth-flow";

export function useSignUp() {
	const { signUp, errors } = useClerkSignUp();
	const flow = useAuthFlow(errors);
	const { call, send, finish } = flow;

	const create = useCallback(
		(input: { email: string; password: string; firstName: string }) =>
			send(
				() =>
					signUp.password({
						emailAddress: input.email.trim(),
						password: input.password,
						firstName: input.firstName.trim() || undefined,
					}),
				() => signUp.verifications.sendEmailCode(),
			),
		[send, signUp],
	);

	const verify = useCallback(
		async (code: string) => {
			await finish(
				() => signUp.verifications.verifyEmailCode({ code }),
				() => signUp.finalize(),
			);
		},
		[finish, signUp],
	);

	const resend = useCallback(
		() => call(() => signUp.verifications.sendEmailCode()),
		[call, signUp],
	);

	return {
		create,
		verify,
		resend,
		busy: flow.busy,
		errorKey: flow.errorKey,
	};
}
