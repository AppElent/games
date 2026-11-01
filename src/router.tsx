import * as Sentry from "@sentry/react";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	if (!router.isServer) {
		// The route template (`/hitster/$sessionId`), never the ids in it.
		const tagScreen = () => {
			Sentry.setTag("screen", router.state.matches.at(-1)?.routeId || "/");
		};
		router.subscribe("onResolved", tagScreen);
		tagScreen();
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
