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
		for (const environment of ["preview", "production"]) {
			expect(
				placements(environment).filter(({ name }) => /TEST_USER/.test(name)),
			).toEqual([]);
		}
	});

	it("gives web PR previews development auth and the preview app production auth", () => {
		const clerk = (environment) =>
			placements(environment)
				.filter(({ name }) => /CLERK/.test(name))
				.map(({ consumer, entry }) => `${consumer} ${entry.infisicalKey}`);
		expect(clerk("preview")).toEqual([
			"expo-build clerk-publishable-key",
			"vite-build pr-clerk-publishable-key",
			"convex-functions pr-clerk-jwt-issuer-domain",
		]);
		for (const environment of ["local", "dev", "production"]) {
			expect(clerk(environment).join()).not.toContain("pr-clerk");
		}
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
		expect(github("production")).toEqual([
			"CLOUDFLARE_ACCOUNT_ID",
			"CLOUDFLARE_API_TOKEN",
			"CONVEX_DEPLOY_KEY",
			"SENTRY_AUTH_TOKEN",
			"VITE_CLERK_PUBLISHABLE_KEY",
			"VITE_SENTRY_DSN",
		]);
	});
});
