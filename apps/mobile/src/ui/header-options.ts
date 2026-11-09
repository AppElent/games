import type { Tokens } from "../theme";

/**
 * A solid native header painted from the palette: accent controls, a
 * back button without its title, no hairline under the bar.
 */
export function headerOptions(colors: Tokens) {
	return {
		headerTintColor: colors.accent,
		headerBackButtonDisplayMode: "minimal" as const,
		headerShadowVisible: false,
		headerStyle: { backgroundColor: colors.bg },
		headerTitleStyle: { color: colors.text },
		contentStyle: { backgroundColor: colors.bg },
	};
}
