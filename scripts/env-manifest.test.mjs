import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
	loadEnvironmentManifest,
	validateEnvironmentManifest,
} from "./lib/env/manifest.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
let manifest;
const placements = (environment) =>
	manifest.placementsFor(environment, { prNumber: "1" });

beforeAll(async () => {
	manifest = await loadEnvironmentManifest(root);
});

describe("Arcade Club environment manifest", () => {
	it("is data only and passes the shared validation without findings", async () => {
		const exports = await import("../env.manifest.ts");
		expect(Object.keys(exports).sort()).toEqual([
			"ENTRIES",
			"ENVIRONMENTS",
			"ENV_CONFIG",
		]);
		expect(validateEnvironmentManifest(manifest)).toEqual([]);
	});

	it("never routes local preparation to a production destination", () => {
		for (const { destination } of placements("local")) {
			expect(JSON.stringify(destination)).not.toMatch(
				/chatty-ram-217|"production"/,
			);
		}
	});

	it("keeps test-user values in local and dev", () => {
		for (const environment of ["preview", "staging", "production"]) {
			expect(
				placements(environment).filter(({ name }) => /TEST_USER/.test(name)),
			).toEqual([]);
		}
	});

	it("writes staging to the preview app and the staging GitHub Environment only", () => {
		const destinations = (environment) =>
			placements(environment).map(({ destination }) =>
				[destination.kind, destination.environment ?? destination.scope].join(
					" ",
				),
			);
		expect(new Set(destinations("staging"))).toEqual(
			new Set(["eas preview", "github staging"]),
		);
		expect(destinations("preview").join()).not.toContain("eas");
	});

	it("names the values the preview and deploy workflows read", () => {
		const github = (environment) =>
			placements(environment)
				.filter(
					({ destination, suppliedBy }) =>
						destination.kind === "github" && !suppliedBy,
				)
				.map(({ name }) => name)
				.sort();
		expect(github("preview")).toEqual([
			"PREVIEW_CLOUDFLARE_ACCOUNT_ID",
			"PREVIEW_CLOUDFLARE_API_TOKEN",
			"PREVIEW_CONVEX_DEPLOY_KEY",
			"PREVIEW_EXPO_TOKEN",
			"PREVIEW_SENTRY_AUTH_TOKEN",
			"PREVIEW_VITE_CLERK_PUBLISHABLE_KEY",
			"PREVIEW_VITE_SENTRY_DSN",
		]);
		for (const environment of ["staging", "production"]) {
			expect(github(environment)).toEqual([
				"CLOUDFLARE_ACCOUNT_ID",
				"CLOUDFLARE_API_TOKEN",
				"CONVEX_DEPLOY_KEY",
				"SENTRY_AUTH_TOKEN",
				"VITE_CLERK_PUBLISHABLE_KEY",
				"VITE_SENTRY_DSN",
			]);
		}
	});

	it("deploys staging with its own Convex key, never the production one", () => {
		const deployKey = (environment) =>
			placements(environment).find(
				({ name, destination }) =>
					name === "CONVEX_DEPLOY_KEY" && destination.kind === "github",
			)?.entry.infisicalKey;
		expect(deployKey("staging")).toBe("convex-staging-deploy-key");
		expect(deployKey("production")).toBe("convex-deploy-key");
	});
});
