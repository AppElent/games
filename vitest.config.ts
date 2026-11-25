import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const resolve = {
	alias: {
		"#": fileURLToPath(new URL("./src", import.meta.url)),
	},
};

export default defineConfig({
	test: {
		// Parallel agent runs share the Mac's memory (APP-852); CI keeps the default.
		// Projects do not extend this config: an inherited cap would beat --maxWorkers.
		maxWorkers: process.env.CI ? undefined : "25%",
		projects: [
			{
				resolve,
				test: {
					name: "web",
					environment: "node",
					exclude: [
						...configDefaults.exclude,
						"**/.claude/**",
						"apps/**",
						"convex/**/*.test.ts",
						// Toolkit examples synced from developer-home: templates to copy, not this repo's tests.
						"docs/standards/**",
					],
				},
			},
			{
				resolve,
				test: {
					name: "convex",
					include: ["convex/**/*.test.ts"],
					environment: "edge-runtime",
					server: { deps: { inline: ["convex-test"] } },
				},
			},
		],
	},
});
