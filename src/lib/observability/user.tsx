import { useAuth } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";

/** Reports carry only the opaque Clerk user id, cleared on sign-out. */
export function SentryUser() {
	const { isLoaded, userId } = useAuth();
	useEffect(() => {
		Sentry.setUser(isLoaded && userId ? { id: userId } : null);
		return () => Sentry.setUser(null);
	}, [isLoaded, userId]);
	return null;
}
