/**
 * Root of the app.
 *
 * The native splash stays up until Clerk has read the cached session and the
 * window colour is set, so the router never paints a frame before it knows
 * who is signed in or which scheme applies.
 *
 * Provider order (outermost first): appearance, gestures, locale, Clerk,
 * Convex, the query cache scoped to the signed-in user, safe area,
 * navigation theme. Language sits outside Clerk because it belongs to the
 * phone and has to apply to the sign-in screens too.
 *
 * Unlike Foundry there is no signed-in shell: guests play everything except
 * hosting online rooms, so `(auth)` is a modal stack over the tabs.
 */
// First, so a crash while the rest of the app loads is still reported.
import "../src/observability/init";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as Sentry from "@sentry/react-native";
import {
	DarkTheme,
	DefaultTheme,
	type ErrorBoundaryProps,
	ErrorBoundary as RouterErrorBoundary,
	Stack,
	ThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";
import { AppQueryCacheProvider } from "../src/convex/query-cache";
import { LocaleProvider, useI18n } from "../src/i18n";
import { sentryEnabled, setFeedbackLocale } from "../src/observability/init";
import { useNavigationBreadcrumbs } from "../src/observability/navigation";
import { reportError } from "../src/observability/report";
import { AppearanceProvider, useAppearance, useTokens } from "../src/theme";

SplashScreen.preventAutoHideAsync();

/** Deep links into a modal or game still get the tabs beneath them. */
export const unstable_settings = { anchor: "(tabs)" };

/**
 * Expo Router's own error screen plus a report: its boundary catches what
 * would otherwise reach the global handler, so Sentry would never see it.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
	const { error } = props;
	useEffect(() => {
		reportError(error);
	}, [error]);
	return <RouterErrorBoundary {...props} />;
}

export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;

function RootLayout() {
	return (
		<AppearanceProvider>
			<ThemedRoot />
		</AppearanceProvider>
	);
}

function ThemedRoot() {
	const { scheme, colors } = useAppearance();
	const [windowReady, setWindowReady] = useState(false);
	const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
	const window = { flex: 1, backgroundColor: colors.bg };

	useEffect(() => {
		let active = true;
		SystemUI.setBackgroundColorAsync(colors.bg)
			.catch(() => {
				// React's root still paints the background if the OS rejects it.
			})
			.finally(() => {
				if (active) setWindowReady(true);
			});
		return () => {
			active = false;
		};
	}, [colors.bg]);

	const navigationTheme = {
		...baseTheme,
		colors: {
			...baseTheme.colors,
			primary: colors.accent,
			background: colors.bg,
			card: colors.surface,
			text: colors.text,
			border: colors.border,
			notification: colors.pink,
		},
	};

	return (
		<GestureHandlerRootView style={window}>
			<LocaleProvider>
				<FeedbackLocale />
				<ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
					<AppConvexProvider>
						<ScopedQueryCache>
							<SafeAreaProvider>
								<ThemeProvider value={navigationTheme}>
									<View style={window}>
										<StatusBar style={scheme === "dark" ? "light" : "dark"} />
										<RootNavigator windowReady={windowReady} />
									</View>
								</ThemeProvider>
							</SafeAreaProvider>
						</ScopedQueryCache>
					</AppConvexProvider>
				</ClerkProvider>
			</LocaleProvider>
		</GestureHandlerRootView>
	);
}

/** The shake-to-report form follows the app's language. */
function FeedbackLocale() {
	const { locale } = useI18n();
	useEffect(() => setFeedbackLocale(locale), [locale]);
	return null;
}

/** A sign-in or sign-out drops every retained subscription. */
function ScopedQueryCache({ children }: { children: ReactNode }) {
	const { userId } = useAuth();
	return (
		<AppQueryCacheProvider scope={userId ?? "guest"}>
			{children}
		</AppQueryCacheProvider>
	);
}

function RootNavigator({ windowReady }: { windowReady: boolean }) {
	const colors = useTokens();
	const { isLoaded } = useAuth();
	const ready = isLoaded && windowReady;
	useNavigationBreadcrumbs();

	useEffect(() => {
		if (ready) SplashScreen.hideAsync();
	}, [ready]);

	// Still resolving the cached session; the splash covers this.
	if (!ready) return null;

	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.accent,
				headerBackButtonDisplayMode: "minimal",
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.bg },
				headerTitleStyle: { color: colors.text },
				contentStyle: { backgroundColor: colors.bg },
			}}
		>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen
				name="(auth)"
				options={{ headerShown: false, presentation: "modal" }}
			/>
		</Stack>
	);
}
