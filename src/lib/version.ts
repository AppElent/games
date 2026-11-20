/**
 * What `GET /version` answers: which build runs here. The release standard
 * (developer-home standards/releases.md) reads it to tell which commit each
 * environment runs, and the deploy smoke check waits for the new commit.
 */
export type VersionInfo = {
	app: "arcadeclub";
	version: string;
	commit: string;
	release: string;
	environment: string;
	/** When the bundle was built; the deploy follows within minutes. */
	deployedAt: string;
	/** The Convex deployment the bundle calls, or null without a Convex URL. */
	convex: string | null;
};

export function versionInfo(environment: string): VersionInfo {
	return {
		app: "arcadeclub",
		version: import.meta.env.VITE_APP_VERSION,
		commit: import.meta.env.VITE_GIT_COMMIT,
		release: import.meta.env.VITE_SENTRY_RELEASE ?? "",
		environment,
		deployedAt: import.meta.env.VITE_BUILT_AT,
		convex: convexDeployment(import.meta.env.VITE_CONVEX_URL),
	};
}

/** The `/version` response, or `null` for any other request. */
export function versionResponse(
	request: Request,
	environment: string,
): Response | null {
	if (request.method !== "GET" && request.method !== "HEAD") return null;
	if (new URL(request.url).pathname !== "/version") return null;
	return Response.json(versionInfo(environment), {
		headers: { "cache-control": "no-store" },
	});
}

/** The Convex deployment the bundle calls, e.g. `limitless-bulldog-972`, from its client URL. */
export function convexDeployment(url: string | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.split(".")[0] || null;
	} catch {
		return null;
	}
}
