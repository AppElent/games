/**
 * The sign-in modal. It opens over whatever asked for an account (the host
 * gate, Profile) and closes itself once Clerk reports a session, so the
 * person lands back where they were. This is the other half of the auth
 * hooks' contract: they never navigate (see `use-auth-flow.ts`).
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated`: the
 * two disagree for the length of the JWT handshake right after sign-in.
 */
import { useAuth } from "@clerk/expo";
import { Stack, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { forgetReturnTarget } from "../../src/auth/return-target";
import { useTokens } from "../../src/theme";
import { headerOptions } from "../../src/ui/header-options";
import { modalCloseHeaderRight } from "../../src/ui/modal-close-button";

export default function AuthLayout() {
	const { isSignedIn } = useAuth();
	const navigation = useNavigation();
	const router = useRouter();
	const colors = useTokens();

	const close = useCallback(() => {
		if (navigation.canGoBack()) navigation.goBack();
		else router.replace("/");
	}, [navigation, router]);

	const signedIn = useRef(isSignedIn);
	useEffect(() => {
		signedIn.current = isSignedIn;
	}, [isSignedIn]);

	// Leaving without signing in (Close, a swipe down, Android back) drops a
	// pending return. Signed in, the modal closes itself and the target stays
	// for the root navigator. `removed` fires after this cleanup, hence the
	// microtask.
	useEffect(() => {
		const unsubscribe = navigation.addListener("removed", () => {
			if (!signedIn.current) forgetReturnTarget();
		});
		return () => queueMicrotask(unsubscribe);
	}, [navigation]);

	useEffect(() => {
		if (isSignedIn) close();
	}, [isSignedIn, close]);

	return (
		<Stack
			screenOptions={{
				...headerOptions(colors),
				title: "",
				headerRight: modalCloseHeaderRight(close),
			}}
		/>
	);
}
