import { Show } from "@clerk/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
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
	const router = useRouter();
	const sent = useRef(false);

	// Once, with the page as it was on mount: the location changes as the
	// navigation starts, and following it would nest `redirect` forever.
	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		const { pathname, href } = router.state.location;
		navigate({
			to: authConfig.paths.signIn,
			search: pathname === authConfig.paths.signIn ? {} : { redirect: href },
		});
	}, [navigate, router]);

	return null;
}
