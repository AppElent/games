import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, SignInForm, safeReturnPath } from "#/lib/auth";
import { useMessages } from "#/lib/i18n";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/sign-in")({
	// Where `RequireSignedIn` sent the visitor from; only an in-app path.
	validateSearch: (search): { redirect?: string } => {
		const redirect = safeReturnPath(search.redirect);
		return redirect ? { redirect } : {};
	},
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const title = useMessages().auth.signIn.title;

	return (
		<AuthCard title={title}>
			<SignInForm
				onSuccess={() =>
					redirect
						? navigate({ href: redirect })
						: navigate({ to: authConfig.paths.afterAuth })
				}
			/>
		</AuthCard>
	);
}
