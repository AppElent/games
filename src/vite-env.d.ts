/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CLERK_PUBLISHABLE_KEY: string;
	readonly VITE_CONVEX_URL: string;
	/** Dev-only test login; set only on non-production builds. */
	readonly VITE_TEST_USER_EMAIL?: string;
	readonly VITE_TEST_USER_PASSWORD?: string;
	readonly VITE_SENTRY_DSN?: string;
	readonly VITE_SENTRY_ENVIRONMENT?: string;
	readonly VITE_SENTRY_RELEASE?: string;
	/** Set by vite.config.ts: `expo.version` from apps/mobile/app.json. */
	readonly VITE_APP_VERSION: string;
	/** Set by vite.config.ts: the full commit SHA the bundle was built from. */
	readonly VITE_GIT_COMMIT: string;
	/** Set by vite.config.ts: ISO time of the build, which a deploy follows. */
	readonly VITE_BUILT_AT: string;
}
