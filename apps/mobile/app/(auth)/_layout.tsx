/**
 * The sign-in modal. It opens over whatever asked for an account (the host
 * gate, Profile) and closes itself once Clerk reports a session, so the
 * person lands back where they were.
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated`: the
 * two disagree for the length of the JWT handshake right after sign-in.
 */
import { useAuth } from "@clerk/expo";
import { Stack, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useI18n } from "../../src/i18n";
import { useTokens } from "../../src/theme";
import { HeaderButton } from "../../src/ui/button";

export default function AuthLayout() {
	const { isSignedIn } = useAuth();
	const navigation = useNavigation();
	const router = useRouter();
	const colors = useTokens();
	const { t } = useI18n();

	useEffect(() => {
		if (!isSignedIn) return;
		if (navigation.canGoBack()) navigation.goBack();
		else router.replace("/");
	}, [isSignedIn, navigation, router]);

	const close = () =>
		navigation.canGoBack() ? navigation.goBack() : router.replace("/");

	return (
		<Stack
			screenOptions={{
				title: "",
				headerTintColor: colors.accent,
				headerBackButtonDisplayMode: "minimal",
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.bg },
				contentStyle: { backgroundColor: colors.bg },
				headerRight:
					Platform.OS === "ios"
						? () => (
								<HeaderButton label={t.common.actions.close} onPress={close} />
							)
						: undefined,
			}}
		/>
	);
}
