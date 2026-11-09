/** The phone as a second client of the web app's Convex deployment. */
import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { env } from "../env";

const CONVEX_URL = env.convexUrl;

if (!CONVEX_URL) {
	throw new Error(
		"EXPO_PUBLIC_CONVEX_URL is not set. Add it to apps/mobile/.env.local (see .env.example).",
	);
}

/**
 * The client logs every failed call with console.error, which in development
 * opens the red overlay. A keyed game error (a wrong room code, an illegal
 * move) is expected and already shown to the player, so it is a warning.
 */
const logger = {
	logVerbose: () => {},
	log: console.log,
	warn: console.warn,
	error: (...args: unknown[]) =>
		(String(args[0]).includes("ConvexError") ? console.warn : console.error)(
			...args,
		),
};

// unsavedChangesWarning installs a beforeunload handler via `window`, which
// does not exist on this runtime.
const convex = new ConvexReactClient(CONVEX_URL, {
	unsavedChangesWarning: false,
	logger,
});

export function AppConvexProvider({ children }: { children: ReactNode }) {
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
