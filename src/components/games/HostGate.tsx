import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { authConfig } from "#/lib/auth-config";

/** Default host name: the signed-in account's first name. */
export function useHostDisplayName(): string {
	const { user } = useUser();
	return user?.firstName || user?.username || "Host";
}

/**
 * Hosting a multiplayer session requires an account (guests can still join).
 * Renders children for signed-in users; guests get a sign-in prompt instead.
 */
export function HostGate({ children }: { children: ReactNode }) {
	return (
		<>
			<SignedIn>{children}</SignedIn>
			<SignedOut>
				<div className="club-panel max-w-xl rounded-lg p-6">
					<h2 className="club-title mb-2 text-xl font-bold text-[var(--club-text)]">
						Sign in to host
					</h2>
					<p className="mb-5 text-sm text-[var(--club-muted)]">
						You need an account to start a game. Your players can join with a
						code or link — no account needed on their side.
					</p>
					<a
						href={authConfig.paths.signIn}
						className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-5 py-2.5 font-bold text-slate-950 no-underline hover:bg-cyan-200"
					>
						Sign in
					</a>
				</div>
			</SignedOut>
		</>
	);
}
