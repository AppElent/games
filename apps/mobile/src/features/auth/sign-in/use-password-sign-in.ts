/**
 * Email + password, all the way to an active session.
 *
 * Clerk Core 3 trap: a successful `signIn.password()` leaves the sign-in
 * `complete` but not active; `finalize()` promotes it. Any other status asks
 * for a step this app does not offer (such as a second factor), reported as
 * `unsupported`.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useAuthFlow } from "../components/use-auth-flow";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const flow = useAuthFlow(errors);
	const { finish } = flow;
	const [unsupported, setUnsupported] = useState(false);

	const submit = useCallback(
		async (email: string, password: string) => {
			setUnsupported(false);
			await finish(
				() => signIn.password({ identifier: email.trim(), password }),
				async () => {
					if (signIn.status === "complete") return signIn.finalize();
					setUnsupported(true);
					return null;
				},
			);
		},
		[finish, signIn],
	);

	return {
		submit,
		busy: flow.busy,
		unsupported,
		errorKey: flow.errorKey,
	};
}
