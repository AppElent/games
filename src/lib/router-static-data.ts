import "@tanstack/react-router";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** When true, the Arcade Header/Footer are hidden and the route owns the whole viewport. */
		fullscreen?: boolean;
	}
}
