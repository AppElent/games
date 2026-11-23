import { Show, useClerk, useUser } from "@clerk/react";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthConfig } from "#/lib/auth/components/auth/AuthConfigProvider";
import { authPageHref, returnTarget } from "#/lib/auth/core";
import { cn } from "#/lib/auth/lib/utils";
import { useMessages } from "#/lib/i18n";

export default function HeaderUser() {
	const messages = useMessages();
	const { user } = useUser();
	const { signOut } = useClerk();
	const config = useAuthConfig();
	const [open, setOpen] = useState(false);
	const here = useRouterState({ select: (s) => s.location.href });
	const initials = (
		user?.firstName?.[0] ??
		user?.primaryEmailAddress?.emailAddress?.[0] ??
		"?"
	).toUpperCase();

	return (
		<>
			<Show when="signed-in">
				<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="club-header-button"
						aria-label={messages.profile.accountMenu}
					>
						{initials}
					</button>
					{open ? (
						<div
							className={cn(
								"absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md",
							)}
						>
							<a
								href={config.paths.account}
								onClick={() => setOpen(false)}
								className="block rounded px-3 py-2 text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-hover-bg)]"
							>
								{messages.profile.account}
							</a>
							<button
								type="button"
								onClick={() => signOut()}
								className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-hover-bg)]"
							>
								{messages.profile.signOut}
							</button>
						</div>
					) : null}
				</div>
			</Show>
			<Show when="signed-out">
				{/* The header bar is dark in both themes, so this link uses the
				    header's nav colour, not the theme-following --auth-fg. */}
				<a
					href={authPageHref(config.paths.signIn, returnTarget(here))}
					className="club-nav-link text-sm font-bold hover:underline"
				>
					{messages.common.actions.signIn}
				</a>
			</Show>
		</>
	);
}
