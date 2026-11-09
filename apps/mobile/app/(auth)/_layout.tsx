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
import { useCallback, useEffect } from "react";
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
