import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The app version lives in one place, the phone app's app.json; web ships
// the same number (developer-home standards/releases.md).
const { version } = JSON.parse(
	readFileSync(new URL("./apps/mobile/app.json", import.meta.url), "utf8"),
).expo;
// GIT_COMMIT lets PR previews name the PR head, not GitHub's merge commit.
const commit =
	process.env.GIT_COMMIT ||
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
// One release, `arcadeclub@<version>+<short sha>`, ties the browser bundle,
// the Worker and their source maps; /version reports the same values.
const release =
	process.env.SENTRY_RELEASE || `arcadeclub@${version}+${commit.slice(0, 7)}`;

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
		"import.meta.env.VITE_GIT_COMMIT": JSON.stringify(commit),
		// BUILT_AT lets the deploy smoke check tell this build from the last one.
		"import.meta.env.VITE_BUILT_AT": JSON.stringify(
			process.env.BUILT_AT || new Date().toISOString(),
		),
	},
	// Maps are uploaded, then generate-sw.mjs deletes the public client copies.
	build: { sourcemap: "hidden" },
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		sentryVitePlugin({
			org: "appelent",
			project: "arcadeclub",
			authToken: process.env.SENTRY_AUTH_TOKEN,
			release: { name: release },
			disable: !process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: { assets: ["dist/**/*.map", "dist/**/*.js"] },
			telemetry: false,
		}),
	],
});

export default config;
