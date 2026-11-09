/**
 * Whether the backend knows who is signed in yet: Clerk says so first, and
 * Convex only after it holds the token. Someone with no account is never
 * waiting; they play as a guest.
 */
import { useAuth } from "@clerk/expo";
import { useConvexAuth } from "convex/react";

export function useBackendAuthReady() {
	const { isSignedIn } = useAuth();
	const convexAuth = useConvexAuth();
	const signedIn = Boolean(isSignedIn);
	return {
		isSignedIn: signedIn,
		/** Convex holds the Clerk token of the signed-in player. */
		ready: signedIn && convexAuth.isAuthenticated,
		/** Convex is still exchanging the token (not settled, unlike `!ready`). */
		loading: signedIn && convexAuth.isLoading,
	};
}
