import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One release ties the browser bundle, the Worker and their source maps.
const release =
	process.env.SENTRY_RELEASE ||
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
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
