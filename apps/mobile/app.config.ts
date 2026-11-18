/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side. `app.json` holds everything shared; this file only
 * swaps the per-variant name, scheme, bundle ID, package and badged icon.
 *
 * `APP_VARIANT` is set per profile in `eas.json`. Unset means a local
 * development build, so a local run never replaces the store install.
 *
 * Production and preview claim the web's `/join` links (iOS universal links,
 * `src/lib/app-links.ts`); development claims nothing, so a local build never
 * takes over real links.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";
import {
	APP_LINK_HOST,
	APPLE_TEAM_ID,
	associatedDomains,
} from "./src/lib/app-links.ts";

/** Every build this app has; also its EAS Update channel and Sentry environment. */
const APP_VARIANTS = {
	production: {
		suffix: "",
		name: "Arcade Club",
		scheme: "arcadeclub",
		icon: "",
	},
	preview: {
		suffix: ".preview",
		name: "Arcade Club Preview",
		scheme: "arcadeclub-preview",
		icon: "-preview",
	},
	development: {
		suffix: ".dev",
		name: "Arcade Club Dev",
		scheme: "arcadeclub-dev",
		icon: "-dev",
	},
} as const;

export type AppVariant = keyof typeof APP_VARIANTS;

function appVariant(value = process.env.APP_VARIANT): AppVariant {
	if (!value) return "development";
	if (value in APP_VARIANTS) return value as AppVariant;
	throw new Error(`Unknown APP_VARIANT "${value}"`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
	const variant = appVariant();
	const { suffix, name, scheme, icon } = APP_VARIANTS[variant];
	const id = `com.appelent.arcadeclub${suffix}`;
	const claims = variant === "production" || variant === "preview";
	return {
		...config,
		name,
		// ExpoConfig requires it; `config` types every field as optional.
		slug: "arcadeclub",
		scheme,
		icon: `./assets/icon${icon}.png`,
		ios: {
			...config.ios,
			bundleIdentifier: id,
			appleTeamId: APPLE_TEAM_ID,
			associatedDomains: associatedDomains(APP_LINK_HOST, claims),
		},
		android: {
			...config.android,
			package: id,
			adaptiveIcon: {
				...config.android?.adaptiveIcon,
				foregroundImage: `./assets/adaptive-icon${icon}.png`,
			},
		},
	};
};
