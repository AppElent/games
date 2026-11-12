// Arcade Club environment manifest. Values live in Infisical, never here.
// Routing is the shared model in docs/standards/environments.md: entries say
// which consumer reads a value in which environment; the engine picks the
// destination. This app's specifics: docs/runbooks/environment.md.

export const ENV_CONFIG = {
	appName: "Arcade Club",
	source: { paths: ["/", "/arcade-club"] },
	convex: {
		project: "eric-jansen:games",
		deployments: {
			dev: "zany-parakeet-507",
			// The staging web's own prod-type deployment, eric-jansen:games:staging.
			staging: "blessed-blackbird-8",
			production: "chatty-ram-217",
		},
	},
	worker: { name: "games" },
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/games" },
};

// "staging" is the staging web (Worker games-staging, its own Convex deployment) and
// the installed preview app (EAS preview), which calls that same staging backend.
// Both read Infisical prod; the staging deploy key, Convex URL and web origin have
// their own Infisical keys. Production Clerk is shared (staging trusts its issuer).
export const ENVIRONMENTS = [
	"local",
	"dev",
	"preview",
	"staging",
	"production",
] as const;

const ALL = ["local", "dev", "preview", "staging", "production"];
const SHIPPED = ["preview", "staging", "production"];
// Mobile builds: development, the preview app (staging) and the store app.
const APP = ["local", "dev", "staging", "production"];
// The preview app (staging) reads the staging backend's own URL and web origin.
const APP_NOT_STAGING = ["local", "dev", "production"];

export const ENTRIES = [
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description: "Public URL of the Convex deployment each client uses.",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CONVEX_URL",
				environments: ALL,
				suppliedIn: {
					local:
						"workspace prepare (or `convex dev`) writes the selected deployment",
					preview: "convex deploy --cmd-url-env-var-name CONVEX_URL",
					staging: "convex deploy --cmd-url-env-var-name CONVEX_URL",
					production: "convex deploy --cmd-url-env-var-name CONVEX_URL",
				},
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: APP_NOT_STAGING,
			},
			"expo-local": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: ["local"],
				suppliedIn: {
					local: "workspace prepare writes the selected backend URL",
				},
			},
		},
	},
	{
		key: "convexStagingUrl",
		infisicalKey: "convex-staging-url",
		description:
			"Public URL of the staging Convex deployment the preview app calls, in Infisical prod.",
		secret: false,
		lands: {
			"expo-build": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: ["staging"],
			},
		},
	},
	{
		key: "convexDeployment",
		infisicalKey: "convex-deployment",
		description: "Selected Convex deployment for local tooling.",
		secret: false,
		lands: {
			"local-tooling": {
				name: "CONVEX_DEPLOYMENT",
				environments: ["local"],
				suppliedIn: {
					local:
						"workspace prepare (or `convex dev`) writes the selected deployment",
				},
			},
		},
	},
	{
		key: "convexDeployKey",
		infisicalKey: "convex-deploy-key",
		description:
			"CI deploy key: preview kind in Infisical staging, `prod:` in prod.",
		secret: true,
		lands: {
			workflow: {
				name: "CONVEX_DEPLOY_KEY",
				environments: ["preview", "production"],
			},
		},
	},
	{
		key: "convexStagingDeployKey",
		infisicalKey: "convex-staging-deploy-key",
		description:
			"`prod:` deploy key of the staging web's Convex deployment, in Infisical prod.",
		secret: true,
		lands: {
			workflow: { name: "CONVEX_DEPLOY_KEY", environments: ["staging"] },
		},
	},
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "pk_test_ in Infisical dev and staging, pk_live_ in prod.",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CLERK_PUBLISHABLE_KEY", environments: ALL },
			"expo-build": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: APP,
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
		description: "Clerk issuer Convex trusts to validate JWTs.",
		secret: false,
		lands: {
			"convex-functions": {
				name: "CLERK_JWT_ISSUER_DOMAIN",
				environments: ALL,
			},
		},
	},
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description: "+clerk_test address on the development instance.",
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
		description: "Password of the development-instance test user.",
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
				environments: ["dev", "production"],
			},
		},
	},
	{
		key: "webStagingOrigin",
		infisicalKey: "web-staging-origin",
		description:
			"Staging web origin the preview app uses for share links, in Infisical prod.",
		secret: false,
		lands: {
			"expo-build": {
				name: "EXPO_PUBLIC_WEB_ORIGIN",
				environments: ["staging"],
			},
		},
	},
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description:
			"Public Sentry DSN for the browser, Worker, mobile app and Convex forwarder.",
		optional: true,
		secret: false,
		lands: {
			"vite-build": { name: "VITE_SENTRY_DSN", environments: ALL },
			"expo-build": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: APP },
			"expo-local": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: ["local"] },
			// scripts/convex-sentry.mjs, run through `pnpm env:exec local`.
			"local-tooling": { name: "SENTRY_CONVEX_DSN", environments: ["local"] },
		},
	},
	{
		key: "sentryDebug",
		infisicalKey: "sentry-debug",
		description:
			"`1` lets a local development bundle of the mobile app report to Sentry.",
		optional: true,
		secret: false,
		lands: {
			"expo-local": {
				name: "EXPO_PUBLIC_SENTRY_DEBUG",
				environments: ["local"],
			},
		},
	},
	{
		key: "sentryAuthToken",
		infisicalKey: "sentry-auth-token",
		description: "Source-map and debug-symbol upload token.",
		optional: true,
		secret: true,
		lands: {
			"local-tooling": { name: "SENTRY_AUTH_TOKEN", environments: ["local"] },
			workflow: { name: "SENTRY_AUTH_TOKEN", environments: SHIPPED },
			"eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: APP },
		},
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-account-token",
		description: "Worker deploy and delete token.",
		secret: true,
		lands: {
			workflow: { name: "CLOUDFLARE_API_TOKEN", environments: SHIPPED },
		},
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account for Worker deploys.",
		secret: false,
		lands: {
			workflow: { name: "CLOUDFLARE_ACCOUNT_ID", environments: SHIPPED },
		},
	},
	{
		key: "expoToken",
		infisicalKey: "expo-token",
		description:
			"Expo access token for Mobile Build and the preview update Deploy publishes.",
		optional: true,
		secret: true,
		lands: { workflow: { name: "EXPO_TOKEN", environments: ["preview"] } },
	},
];
