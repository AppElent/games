/**
 * The stack inside each tab: a large native title on iOS, a plain app bar on
 * Android, both painted from the token palette.
 */
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTokens } from "../theme";
import { headerOptions } from "./header-options";

/** iOS 26+ draws its own scroll-edge glass under the header; a blur on top doubles it. */
const NEEDS_HEADER_BLUR =
	Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) < 26;

export function TabStack({ title }: { title: string }) {
	const colors = useTokens();
	// iOS draws a transparent large-title header over the content instead.
	const { headerStyle, headerShadowVisible, ...shared } = headerOptions(colors);
	return (
		<Stack
			screenOptions={
				Platform.OS === "ios"
					? {
							...shared,
							headerLargeTitle: true,
							headerTransparent: true,
							headerBlurEffect: NEEDS_HEADER_BLUR
								? "systemChromeMaterial"
								: undefined,
							headerLargeStyle: { backgroundColor: "transparent" },
							headerLargeTitleStyle: { color: colors.text },
						}
					: { ...shared, headerStyle, headerShadowVisible }
			}
		>
			<Stack.Screen name="index" options={{ title }} />
		</Stack>
	);
}
