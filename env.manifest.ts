/**
 * Arcade Club environment routing.
 *
 * Entries describe logical values and their consumers. destinationFor maps a
 * consumer in an app environment to the place that consumer reads from. The
 * environment engine in scripts/env.mjs performs checks and effects from the
 * resulting placements.
 */

export const ENV_CONFIG = {
	appName: "Arcade Club",
	source: {
		environments: {
			local: "dev",
			preview: "staging",
			dev: "dev",
			production: "prod",
		},
		paths: ["/", "/arcade-club"],
	},
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/games" },
} as const;

/** The fixed Convex deployments behind the dev and production environments. */
export const CONVEX_DEPLOYMENTS = {
	dev: "zany-parakeet-507",
	production: "chatty-ram-217",
} as const;

export const ENVIRONMENTS = ["local", "preview", "dev", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const CONSUMERS = [
	"vite-build",
	"local-tooling",
	"convex-functions",
	"workflow",
	"expo-build",
	"eas-tooling",
	"expo-local",
] as const;
export type Consumer = (typeof CONSUMERS)[number];

export type Destination =
	| { kind: "file"; path: string }
	| {
			kind: "convex";
			target: "dev" | "preview-default" | "production" | string;
			deployment?: string;
			project?: string;
	  }
	| { kind: "github"; scope: "repo" | string }
	| { kind: "eas"; environment: "development" | "preview" | "production" };

/** Preserve the repo secret names consumed by the existing preview workflow. */
export function githubName(name: string, scope: string) {
	if (scope === "repo" && name === "VITE_CLERK_PUBLISHABLE_KEY") {
		return "PREVIEW_CLERK_PUBLISHABLE_KEY";
	}
	return name;
}

export function destinationFor(
	consumer: Consumer,
	environment: Environment,
): Destination | null {
	switch (consumer) {
		case "vite-build":
			switch (environment) {
				case "local":
					return { kind: "file", path: ".env.local" };
				case "preview":
					return { kind: "github", scope: "repo" };
				case "dev":
					return { kind: "file", path: ".env.development.local" };
				case "production":
					// The deploy workflow builds production in CI.
					return { kind: "github", scope: "production" };
			}
			break;
		case "local-tooling":
			return environment === "local"
				? { kind: "file", path: ".env.local" }
				: null;
		case "convex-functions":
			switch (environment) {
				case "local":
					return { kind: "convex", target: "dev" };
				case "preview":
					return {
						kind: "convex",
						target: "preview-default",
						project: "eric-jansen:games",
					};
				case "dev":
					return {
						kind: "convex",
						target: "dev",
						deployment: CONVEX_DEPLOYMENTS.dev,
					};
				case "production":
					return {
						kind: "convex",
						target: "production",
						deployment: CONVEX_DEPLOYMENTS.production,
					};
			}
			break;
		case "workflow":
			switch (environment) {
				case "preview":
					return { kind: "github", scope: "repo" };
				case "production":
					return { kind: "github", scope: "production" };
				default:
					return null;
			}
		case "expo-build":
		case "eas-tooling":
			switch (environment) {
				case "local":
				case "dev":
					return { kind: "eas", environment: "development" };
				case "preview":
					return { kind: "eas", environment: "preview" };
				case "production":
					return { kind: "eas", environment: "production" };
			}
			break;
		case "expo-local":
			return environment === "local"
				? { kind: "file", path: "apps/mobile/.env.local" }
				: null;
	}
	return null;
}

type Landing = {
	name: string;
	environments: readonly Environment[];
	suppliedIn?: Partial<Record<Environment, string>>;
};

type ViteLanding = Landing & { name: `VITE_${string}` };
type ExpoLanding = Landing & { name: `EXPO_PUBLIC_${string}` };

type Lands = Partial<
	Record<Exclude<Consumer, "vite-build" | "expo-build" | "expo-local">, Landing>
> & {
	"vite-build"?: ViteLanding;
	"expo-build"?: ExpoLanding;
	"expo-local"?: ExpoLanding;
};

type BaseEntry = {
	key: string;
	/** Canonical source name in the shared Infisical project. */
	infisicalKey: string;
	description: string;
	optional?: true;
	lands: Lands;
};

export type Entry =
	| (BaseEntry & { secret: false })
	| (BaseEntry & {
			secret: true;
			lands: Omit<Lands, "vite-build" | "expo-build" | "expo-local"> & {
				"vite-build"?: never;
				"expo-build"?: never;
				"expo-local"?: never;
			};
	  });

export const ENTRIES = [
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description:
			"Public Sentry DSN for client errors, performance, replay, and feedback.",
		secret: false,
		optional: true,
		lands: {
			"vite-build": {
				name: "VITE_SENTRY_DSN",
				environments: ["local", "preview", "dev", "production"],
			},
			"expo-build": {
				name: "EXPO_PUBLIC_SENTRY_DSN",
				environments: ["local", "preview", "dev", "production"],
			},
			"expo-local": {
				name: "EXPO_PUBLIC_SENTRY_DSN",
				environments: ["local"],
			},
		},
	},
	{
		key: "sentryAuthToken",
		infisicalKey: "sentry-auth-token",
		description:
			"Build-only Sentry token for source-map and debug-symbol uploads.",
		secret: true,
		optional: true,
		lands: {
			"local-tooling": { name: "SENTRY_AUTH_TOKEN", environments: ["local"] },
			workflow: {
				name: "SENTRY_AUTH_TOKEN",
				environments: ["preview", "production"],
			},
			"eas-tooling": {
				name: "SENTRY_AUTH_TOKEN",
				environments: ["local", "preview", "dev", "production"],
			},
		},
	},
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "Clerk publishable key used by the web and mobile clients.",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CLERK_PUBLISHABLE_KEY",
				environments: ["local", "preview", "dev", "production"],
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: ["local", "preview", "dev", "production"],
			},
			"expo-local": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: ["local"],
			},
		},
	},
	{
		key: "clerkJwtIssuerDomain",
		infisicalKey: "clerk-jwt-issuer-domain",
		description: "Clerk issuer domain used by Convex to validate JWTs.",
		secret: false,
		lands: {
			"convex-functions": {
				name: "CLERK_JWT_ISSUER_DOMAIN",
				environments: ["local", "preview", "dev", "production"],
			},
		},
	},
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description: "Public URL of the Convex deployment used by each client.",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CONVEX_URL",
				environments: ["local", "preview", "dev", "production"],
				suppliedIn: {
					local: "`convex dev` writes the selected deployment to .env.local",
					preview: "convex deploy --cmd-url-env-var-name CONVEX_URL",
					production: "convex deploy --cmd-url-env-var-name CONVEX_URL",
				},
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: ["local", "preview", "dev", "production"],
			},
			"expo-local": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: ["local"],
				suppliedIn: {
					local: "set by hand to the local backend reachable from the device",
				},
			},
		},
	},
	{
		key: "convexDeployment",
		infisicalKey: "convex-deployment",
		description: "Selected Convex deployment reference for local tooling.",
		secret: false,
		lands: {
			"local-tooling": {
				name: "CONVEX_DEPLOYMENT",
				environments: ["local"],
				suppliedIn: {
					local: "`convex dev` writes the selected deployment to .env.local",
				},
			},
		},
	},
	{
		key: "convexDeployKey",
		infisicalKey: "convex-deploy-key",
		description:
			"Convex deploy key scoping every `convex` command in CI to one deployment; its prefix (`preview:` / `prod:`) picks the target.",
		secret: true,
		lands: {
			workflow: {
				name: "CONVEX_DEPLOY_KEY",
				environments: ["preview", "production"],
				suppliedIn: {
					preview:
						"the existing preview deploy key for eric-jansen:games in GitHub secrets",
				},
			},
		},
	},
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description:
			"Optional Clerk test-user email published in non-production clients.",
		optional: true,
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_TEST_USER_EMAIL",
				environments: ["local", "dev"],
			},
			"expo-build": {
				name: "EXPO_PUBLIC_TEST_USER_EMAIL",
				environments: ["local", "dev"],
			},
			"expo-local": {
				name: "EXPO_PUBLIC_TEST_USER_EMAIL",
				environments: ["local"],
			},
		},
	},
	{
		key: "testUserPassword",
		infisicalKey: "test-user-password",
		description:
			"Optional Clerk test-user password published in non-production clients.",
		optional: true,
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_TEST_USER_PASSWORD",
				environments: ["local", "dev"],
			},
			"expo-build": {
				name: "EXPO_PUBLIC_TEST_USER_PASSWORD",
				environments: ["local", "dev"],
			},
			"expo-local": {
				name: "EXPO_PUBLIC_TEST_USER_PASSWORD",
				environments: ["local"],
			},
		},
	},
	{
		key: "webOrigin",
		infisicalKey: "web-origin",
		description: "Web origin the mobile app uses for share links.",
		secret: false,
		lands: {
			"expo-build": {
				name: "EXPO_PUBLIC_WEB_ORIGIN",
				environments: ["preview", "dev", "production"],
			},
		},
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-account-token",
		description: "Cloudflare token used by CI to deploy and remove Workers.",
		secret: true,
		lands: {
			workflow: {
				name: "CLOUDFLARE_API_TOKEN",
				environments: ["preview", "production"],
			},
		},
	},
	{
		key: "expoToken",
		infisicalKey: "expo-token",
		description:
			"Expo access token for CI: `eas build --local` in the opt-in Mobile Build workflow and the preview over-the-air update that Deploy publishes (expo.dev → Access tokens). Repo scope, so both workflows read it.",
		optional: true,
		secret: true,
		lands: {
			workflow: { name: "EXPO_TOKEN", environments: ["preview"] },
		},
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account identifier used by CI.",
		secret: true,
		lands: {
			workflow: {
				name: "CLOUDFLARE_ACCOUNT_ID",
				environments: ["preview", "production"],
			},
		},
	},
] as const satisfies readonly Entry[];

export type Placement = {
	entry: Entry;
	consumer: Consumer;
	environment: Environment;
	name: string;
	destination: Destination;
	suppliedBy: string | null;
};

export function placementsFor(environment: Environment): Placement[] {
	const placements: Placement[] = [];
	for (const entry of ENTRIES as readonly Entry[]) {
		for (const consumer of CONSUMERS) {
			const landing = entry.lands[consumer];
			if (!landing || !landing.environments.includes(environment)) continue;
			const destination = destinationFor(consumer, environment);
			if (!destination) continue;
			placements.push({
				entry,
				consumer,
				environment,
				name:
					destination.kind === "github"
						? githubName(landing.name, destination.scope)
						: landing.name,
				destination,
				suppliedBy: landing.suppliedIn?.[environment] ?? null,
			});
		}
	}
	return placements;
}
