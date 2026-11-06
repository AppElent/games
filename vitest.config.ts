import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"#": fileURLToPath(new URL("./src", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
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
						"**/node_modules_OLD/**",
						"**/node_modules.*/**",
						"apps/**",
						"convex/**/*.test.ts",
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
