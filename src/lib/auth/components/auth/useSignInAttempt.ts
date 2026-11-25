import { useCallback, useEffect, useRef } from "react";

/**
 * Clerk keeps one sign-in per page and writes every answer into it, so an
 * answer to an earlier submit would otherwise act on a later one. Counts each
 * form that opens and each submit, across all sign-in forms.
 */
let latest = 0;

export type SignInAttempt = {
	/** No sign-in form has opened and nothing was submitted since. */
	isLatest: () => boolean;
	/** Also: the form that started it is still on screen. */
	isShown: () => boolean;
};

/**
 * Returns `begin`, to call on each submit. A superseded attempt must not
 * finalize or change the form; one whose form closed may still sign in, but
 * not navigate.
 */
export function useSignInAttempt(): () => SignInAttempt {
	const mounted = useRef(false);
	useEffect(() => {
		latest++;
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	return useCallback(() => {
		const id = ++latest;
		const isLatest = () => id === latest;
		return { isLatest, isShown: () => isLatest() && mounted.current };
	}, []);
}
