import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AuthCard,
	SignInForm,
	safeReturnPath,
	signInDestination,
} from "#/lib/auth";
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
	// Checked again here: the root route passes the raw search through, so
	// `useSearch` can still hold what `validateSearch` dropped.
	const { redirect } = Route.useSearch();
	const destination = signInDestination(redirect, authConfig.paths.afterAuth);
	const title = useMessages().auth.signIn.title;

	return (
		<AuthCard title={title}>
			<SignInForm
				redirect={redirect}
				onSuccess={() => navigate({ href: destination })}
			/>
		</AuthCard>
	);
}
