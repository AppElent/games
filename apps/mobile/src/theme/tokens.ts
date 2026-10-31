/**
 * The phone's palette, spacing, radii and type ramp.
 *
 * Colours transcribe the web app's `--club-*` tokens (`src/styles.css`), so
 * both surfaces read as the same Arcade Club. Dark is the brand default; light
 * mirrors the web `.light` overrides. Components read `useTokens()`; nothing
 * outside this file spells a hex value or a `fontSize`.
 */
import { type ColorValue, DynamicColorIOS, Platform } from "react-native";

export const darkColors = {
	bg: "#080a12",
	surface: "#121626",
	surface2: "#191f34",
	surfacePressed: "#222a44",
	border: "rgba(148, 163, 184, 0.18)",
	borderStrong: "rgba(148, 163, 184, 0.34)",
	text: "#f8fafc",
	textMuted: "#aab6cc",
	textFaint: "#7c8aa3",
	accent: "#22d3ee",
	accentPressed: "#67e8f9",
	accentDim: "rgba(34, 211, 238, 0.14)",
	onAccent: "#04121a",
	green: "#34d399",
	greenDim: "rgba(52, 211, 153, 0.16)",
	pink: "#f472b6",
	pinkDim: "rgba(244, 114, 182, 0.16)",
	orange: "#fb923c",
	orangeDim: "rgba(251, 146, 60, 0.16)",
	danger: "#fb7185",
	dangerDim: "rgba(251, 113, 133, 0.14)",
	scrim: "rgba(0, 0, 0, 0.6)",
} as const;

export type Tokens = { readonly [K in keyof typeof darkColors]: string };

export const lightColors: Tokens = {
	bg: "#f8fafc",
	surface: "#ffffff",
	surface2: "#eef2f7",
	surfacePressed: "#e2e8f0",
	border: "rgba(15, 23, 42, 0.12)",
	borderStrong: "rgba(15, 23, 42, 0.26)",
	text: "#0f172a",
	textMuted: "#475569",
	textFaint: "#64748b",
	accent: "#0e7490",
	accentPressed: "#155e75",
	accentDim: "rgba(14, 116, 144, 0.10)",
	onAccent: "#ffffff",
	green: "#047857",
	greenDim: "rgba(4, 120, 87, 0.10)",
	pink: "#be185d",
	pinkDim: "rgba(190, 24, 93, 0.10)",
	orange: "#c2410c",
	orangeDim: "rgba(194, 65, 12, 0.10)",
	danger: "#be123c",
	dangerDim: "rgba(190, 18, 60, 0.09)",
	scrim: "rgba(0, 0, 0, 0.4)",
};

/**
 * Player-chosen cell markers (Sudoku colour mode). Translucent so the digit
 * and the scheme's background both read through; the same set works in
 * light and dark.
 */
export const markerColors = [
	"rgba(56, 189, 248, 0.42)",
	"rgba(52, 211, 153, 0.42)",
	"rgba(251, 191, 36, 0.45)",
	"rgba(251, 113, 133, 0.42)",
	"rgba(167, 139, 250, 0.45)",
	"rgba(45, 212, 191, 0.42)",
	"rgba(251, 146, 60, 0.45)",
	"rgba(244, 114, 182, 0.42)",
] as const;

export const spacing = {
	xxs: 2,
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 28,
	xxxl: 40,
} as const;

export const radius = {
	sm: 8,
	md: 12,
	lg: 18,
	xl: 24,
	pill: 999,
} as const;

/** Layout floors. Heights are minimums so Dynamic Type can grow a row. */
export const metrics = {
	screenGutter: 20,
	hitTarget: 44,
	controlHeight: 50,
	contentMaxWidth: 640,
} as const;

export const motion = {
	durFast: 150,
	durBase: 250,
} as const;

export const opacity = {
	pressed: 0.7,
	disabled: 0.45,
} as const;

/**
 * Named text styles. Screens pick a name through `AppText`; nothing else sets
 * a `fontSize`. Board digits have their own entries because a cell's glyph is
 * sized to the cell, not to the reading ramp.
 */
export const type = {
	display: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
	title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
	heading: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 16, fontWeight: "500" },
	secondary: { fontSize: 15, fontWeight: "400" },
	label: { fontSize: 13, fontWeight: "700", letterSpacing: 0.6 },
	caption: { fontSize: 12, fontWeight: "500" },
	control: { fontSize: 16, fontWeight: "700" },
	metric: { fontSize: 28, fontWeight: "800" },
	code: { fontSize: 30, fontWeight: "800", letterSpacing: 6 },
	cellLarge: { fontSize: 24, fontWeight: "600" },
	cellMedium: { fontSize: 18, fontWeight: "600" },
	cellNote: { fontSize: 9, fontWeight: "600" },
	cellCenterNote: { fontSize: 10, fontWeight: "700" },
	keypad: { fontSize: 24, fontWeight: "600" },
} as const;

function dynamic(dark: string, light: string): ColorValue {
	return Platform.OS === "ios" ? DynamicColorIOS({ dark, light }) : dark;
}

/**
 * Colours for native chrome (tab bar, headers) that UIKit resolves per trait,
 * so Liquid Glass stays legible whichever scheme it picks. Content never uses
 * these; content reads `useTokens()`.
 */
export const chrome = {
	text: dynamic(darkColors.text, lightColors.text),
	textMuted: dynamic(darkColors.textMuted, lightColors.textMuted),
	accent: dynamic(darkColors.accent, lightColors.accent),
} as const;
