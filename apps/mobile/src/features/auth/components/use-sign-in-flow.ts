/**
 * The end every sign-in shares: run its first steps, then `finalize()` a
 * complete one. Clerk can want a second factor first, which the caller opens
 * a screen for (hooks never navigate); any other status asks for a step this
 * app does not offer, reported as `unsupported`.
 */
import type { ClerkErrorSignal } from "@arcadeclub/core/auth-errors";
import { needsSecondFactor } from "@arcadeclub/core/second-factor";
import type { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { type Step, useAuthFlow } from "./use-auth-flow";

export type SignInOutcome = "signedIn" | "secondFactor" | "stopped";

export function useSignInFlow(
	signIn: ReturnType<typeof useSignIn>["signIn"],
	errors: ClerkErrorSignal | null | undefined,
) {
	const flow = useAuthFlow(errors);
	const { finish } = flow;
	const [unsupported, setUnsupported] = useState(false);

	const finishSignIn = useCallback(
		async (...steps: Step[]): Promise<SignInOutcome> => {
			let secondFactor = false;
			setUnsupported(false);
			const done = await finish(...steps, async () => {
				if (signIn.status === "complete") return signIn.finalize();
				if (needsSecondFactor(signIn.status)) secondFactor = true;
				else setUnsupported(true);
				return null;
			});
			if (done) return "signedIn";
			return secondFactor ? "secondFactor" : "stopped";
		},
		[finish, signIn],
	);

	return { ...flow, finishSignIn, unsupported };
}
