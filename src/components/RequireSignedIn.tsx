import { Show } from "@clerk/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { authConfig } from "#/lib/auth-config";

/**
 * A page for accounts only: signed-out visitors go to sign-in, which brings
 * them back here afterwards.
 */
export function RequireSignedIn({ children }: { children: ReactNode }) {
	return (
		<>
			<Show when="signed-in">{children}</Show>
			<Show when="signed-out">
				<RedirectToSignIn />
			</Show>
		</>
	);
}

function RedirectToSignIn() {
	const navigate = useNavigate();
	const here = useLocation({ select: (location) => location.href });

	useEffect(() => {
		navigate({ to: authConfig.paths.signIn, search: { redirect: here } });
	}, [navigate, here]);

	return null;
}
