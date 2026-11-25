/**
 * Opens the second step once a first step's answer says so, but only from a
 * screen the person is still on. Close, a swipe and Android back stay
 * available while Clerk answers, and `useRouter` acts on whatever is focused
 * by then: a late answer would replace the game behind the closed modal.
 * Not opening leaves the attempt alone, since a newer one may be running.
 */
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";

export function useOpenSecondFactor() {
	const router = useRouter();
	const focused = useRef(false);
	useFocusEffect(
		useCallback(() => {
			focused.current = true;
			return () => {
				focused.current = false;
			};
		}, []),
	);
	return useCallback(
		(how: "push" | "replace", href: Href = "/sign-in-second-factor") => {
			if (focused.current) router[how](href);
		},
		[router],
	);
}
