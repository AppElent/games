/**
 * The phone as a second client of the web app's Convex deployment.
 * Static `process.env.EXPO_PUBLIC_*` access is load-bearing (see
 * `src/auth/config.ts`).
 */
import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
	throw new Error(
		"EXPO_PUBLIC_CONVEX_URL is not set. Add it to apps/mobile/.env.local (see .env.example).",
	);
}

// unsavedChangesWarning installs a beforeunload handler via `window`, which
// does not exist on this runtime.
const convex = new ConvexReactClient(CONVEX_URL, {
	unsavedChangesWarning: false,
});

export function AppConvexProvider({ children }: { children: ReactNode }) {
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
