/**
 * The stack inside each tab: a large native title on iOS, a plain app bar on
 * Android, both painted from the token palette.
 */
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTokens } from "../theme";

export function TabStack({ title }: { title: string }) {
	const colors = useTokens();
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.accent,
				headerBackButtonDisplayMode: "minimal",
				contentStyle: { backgroundColor: colors.bg },
				...(Platform.OS === "ios"
					? {
							headerLargeTitle: true,
							headerTransparent: true,
							headerBlurEffect: "systemChromeMaterial",
							headerLargeStyle: { backgroundColor: "transparent" },
							headerLargeTitleStyle: { color: colors.text },
							headerTitleStyle: { color: colors.text },
						}
					: {
							headerStyle: { backgroundColor: colors.bg },
							headerTitleStyle: { color: colors.text },
							headerShadowVisible: false,
						}),
			}}
		>
			<Stack.Screen name="index" options={{ title }} />
		</Stack>
	);
}
