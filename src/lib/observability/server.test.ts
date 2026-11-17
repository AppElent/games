import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	startFetch: vi.fn(),
	sentryFetch: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: mocks.startFetch },
}));
vi.mock("@sentry/cloudflare", () => ({
	withSentry: () => ({ fetch: mocks.sentryFetch }),
}));

import server from "../../server";

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

it("bypasses Sentry for a local SSR failure despite production bindings", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const request = new Request("http://localhost:3000/");
	const ctx = {} as ExecutionContext;

	expect(
		await server.fetch(request, { environment_name: "production" }, ctx),
	).toBe(response);
	expect(mocks.startFetch).toHaveBeenCalledWith(request);
	expect(mocks.sentryFetch).not.toHaveBeenCalled();
});

it("keeps the Sentry wrapper for deployed requests", async () => {
	const response = new Response("ok");
	mocks.sentryFetch.mockResolvedValue(response);
	const request = new Request("https://games.appelent.workers.dev/");
	const env = { environment_name: "production" };
	const ctx = {} as ExecutionContext;

	expect(await server.fetch(request, env, ctx)).toBe(response);
	expect(mocks.sentryFetch).toHaveBeenCalledWith(request, env, ctx);
	expect(mocks.startFetch).not.toHaveBeenCalled();
});

it("answers /version itself, uncached, with the Worker's environment", async () => {
	// vite.config.ts defines these at build time; the test config does not.
	vi.stubEnv("VITE_APP_VERSION", "1.4.0");
	vi.stubEnv("VITE_GIT_COMMIT", "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
	vi.stubEnv("VITE_SENTRY_RELEASE", "arcadeclub@1.4.0+a1b2c3d");
	vi.stubEnv("VITE_BUILT_AT", "2026-11-17T08:00:00.000Z");
	const request = new Request("https://arcade-club-stg.appelent.nl/version");
	const ctx = {} as ExecutionContext;

	const response = await server.fetch(
		request,
		{ environment_name: "staging" },
		ctx,
	);
	expect(response.headers.get("cache-control")).toBe("no-store");
	const body = await response.json();
	expect(body).toEqual({
		app: "arcadeclub",
		version: "1.4.0",
		commit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
		release: "arcadeclub@1.4.0+a1b2c3d",
		environment: "staging",
		deployedAt: "2026-11-17T08:00:00.000Z",
	});
	expect(mocks.startFetch).not.toHaveBeenCalled();
	expect(mocks.sentryFetch).not.toHaveBeenCalled();
});

it("leaves other paths and methods to the app", async () => {
	const response = new Response("ok");
	mocks.sentryFetch.mockResolvedValue(response);
	const ctx = {} as ExecutionContext;
	for (const request of [
		new Request("https://arcade-club.appelent.nl/version/x"),
		new Request("https://arcade-club.appelent.nl/version", { method: "POST" }),
	]) {
		expect(await server.fetch(request, {}, ctx)).toBe(response);
	}
});
