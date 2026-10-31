/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side. `app.json` holds everything shared; this file only
 * swaps the per-variant name, scheme, bundle ID, package and icons.
 *
 * `APP_VARIANT` is set per profile in `eas.json`. Unset means a local
 * development build, so a local run never replaces the store install.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppVariant = "development" | "preview" | "production";

const VARIANTS = {
	production: { suffix: "", name: "Arcade Club", scheme: "arcadeclub" },
	preview: {
		suffix: ".preview",
		name: "Arcade Club Preview",
		scheme: "arcadeclub-preview",
	},
	development: {
		suffix: ".dev",
		name: "Arcade Club Dev",
		scheme: "arcadeclub-dev",
	},
} as const satisfies Record<AppVariant, object>;

export function appVariant(value = process.env.APP_VARIANT): AppVariant {
	if (!value) return "development";
	if (value in VARIANTS) return value as AppVariant;
	throw new Error(`Unknown APP_VARIANT "${value}"`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
	const variant = appVariant();
	const { suffix, name, scheme } = VARIANTS[variant];
	const id = `com.appelent.arcadeclub${suffix}`;
	return {
		...config,
		name,
		slug: "arcadeclub",
		scheme,
		icon: "./assets/icon.png",
		ios: { ...config.ios, bundleIdentifier: id },
		android: {
			...config.android,
			package: id,
			adaptiveIcon: {
				...config.android?.adaptiveIcon,
				foregroundImage: "./assets/adaptive-icon.png",
			},
		},
	};
};
