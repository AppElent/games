import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"#": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		projects: [
			{
				extends: true,
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
				extends: true,
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
