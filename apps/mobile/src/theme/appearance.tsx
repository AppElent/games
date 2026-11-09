import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { readText, STORAGE_KEYS, writeText } from "../storage/local-store";
import { darkColors, lightColors, type Tokens } from "./tokens";

export type AppearancePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

function readAppearance(): AppearancePreference {
	const saved = readText(STORAGE_KEYS.appearance);
	return saved === "light" || saved === "dark" ? saved : "system";
}

function overrideNativeScheme(preference: AppearancePreference) {
	if (Platform.OS === "web") return;
	Appearance.setColorScheme(
		preference === "system" ? "unspecified" : preference,
	);
}

type AppearanceValue = {
	preference: AppearancePreference;
	scheme: ColorScheme;
	colors: Tokens;
	setPreference: (next: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

/** Phone-local appearance, resolved synchronously before the first frame. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
	const [preference, setStoredPreference] = useState(readAppearance);
	const nativeScheme = useColorScheme();
	const scheme: ColorScheme =
		preference === "system"
			? nativeScheme === "light"
				? "light"
				: "dark"
			: preference;

	useLayoutEffect(() => {
		overrideNativeScheme(preference);
	}, [preference]);

	const setPreference = useCallback((next: AppearancePreference) => {
		overrideNativeScheme(next);
		writeText(STORAGE_KEYS.appearance, next);
		setStoredPreference(next);
	}, []);

	const value = useMemo(
		() => ({
			preference,
			scheme,
			colors: scheme === "dark" ? darkColors : lightColors,
			setPreference,
		}),
		[preference, scheme, setPreference],
	);

	return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceValue {
	const value = use(AppearanceContext);
	if (!value)
		throw new Error("useAppearance must be used within AppearanceProvider");
	return value;
}

export function useTokens(): Tokens {
	return useAppearance().colors;
}

/** Cache each stylesheet until the palette changes. */
export function useThemedStyles<T>(createStyles: (colors: Tokens) => T): T {
	const colors = useTokens();
	return useMemo(() => createStyles(colors), [createStyles, colors]);
}
