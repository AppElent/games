import { Show } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { authConfig } from "#/lib/auth-config";

/** A page for accounts only: signed-out visitors go to sign-in. */
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

	useEffect(() => {
		navigate({ to: authConfig.paths.signIn });
	}, [navigate]);

	return null;
}
