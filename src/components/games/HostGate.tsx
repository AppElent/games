import { Show } from "@clerk/react";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authPageHref, returnTarget } from "#/lib/auth";
import { authConfig } from "#/lib/auth-config";
import { useMessages } from "#/lib/i18n";

/**
 * Hosting a multiplayer session requires an account (guests can still join).
 * Renders children for signed-in users; guests get a sign-in prompt instead,
 * which brings them back to this page afterwards.
 */
export function HostGate({ children }: { children: ReactNode }) {
	const messages = useMessages();
	const here = useRouterState({ select: (s) => s.location.href });
	return (
		<>
			<Show when="signed-in">{children}</Show>
			<Show when="signed-out">
				<div className="club-panel max-w-xl rounded-lg p-6">
					<h2 className="club-title mb-2 text-xl font-bold text-[var(--club-text)]">
						{messages.common.hostGate.heading}
					</h2>
					<p className="mb-5 text-sm text-[var(--club-muted)]">
						{messages.common.hostGate.body}
					</p>
					<a
						href={authPageHref(authConfig.paths.signIn, returnTarget(here))}
						className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-5 py-2.5 font-bold text-slate-950 no-underline hover:bg-cyan-200"
					>
						{messages.common.hostGate.signIn}
					</a>
				</div>
			</Show>
		</>
	);
}
