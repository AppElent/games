import { defineConfig } from "vitest/config";

// Used when Vitest runs inside this package, as the Stop hook does; the root
// config covers `pnpm test`.
export default defineConfig({
	test: {
		// Parallel agent runs share the Mac's memory (APP-852); CI keeps the default.
		maxWorkers: process.env.CI ? undefined : "25%",
	},
});
