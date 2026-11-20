/** Renders a screen inside the providers the app mounts around every screen. */
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "../src/i18n";
import { AppearanceProvider } from "../src/theme/appearance";

const SCREEN = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderScreen(screen: ReactElement) {
	return render(
		<LocaleProvider>
			<AppearanceProvider>
				<SafeAreaProvider initialMetrics={SCREEN}>{screen}</SafeAreaProvider>
			</AppearanceProvider>
		</LocaleProvider>,
	);
}
