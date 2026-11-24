/**
 * Drives one second step (`createSecondFactorFlow`) for `SecondFactorStep`.
 * The caller says which factors Clerk offers and what sending and verifying
 * mean, so a check other than a sign-in can reuse the step. Both are read
 * once, when the step opens.
 */
import {
	createSecondFactorFlow,
	type SecondFactorActions,
	signInSecondFactor,
} from "@arcadeclub/core/second-factor";
import { useSignIn } from "@clerk/expo";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

export function useSecondFactor(
	factors: Parameters<typeof createSecondFactorFlow>[0],
	actions: SecondFactorActions,
) {
	const [flow] = useState(() => createSecondFactorFlow(factors, actions));
	const state = useSyncExternalStore(flow.subscribe, flow.getState);
	useEffect(() => flow.start(), [flow]);
	return { flow, state };
}

/** The step as the end of a sign-in; `finalize()` closes the modal. */
export function useSignInSecondFactor() {
	const { signIn } = useSignIn();
	const live = useRef(signIn);
	useEffect(() => {
		live.current = signIn;
	}, [signIn]);
	const [actions] = useState(() => signInSecondFactor(() => live.current));
	const step = useSecondFactor(signIn.supportedSecondFactors, actions);

	/** Drops the attempt; makes no request. */
	const cancel = useCallback(async () => {
		try {
			await live.current.reset();
		} catch {
			// The next sign-in starts a new attempt either way.
		}
	}, []);

	return { ...step, cancel };
}
