import { ClerkProvider } from "@clerk/react";
import { AuthConfigProvider } from "#/lib/auth";
import { authConfig } from "../../lib/auth-config";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
	throw new Error("Add your Clerk Publishable Key to the .env.local file");
}

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
			<AuthConfigProvider config={authConfig}>{children}</AuthConfigProvider>
		</ClerkProvider>
	);
}
