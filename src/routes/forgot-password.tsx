import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AuthCard,
	authPageHref,
	ForgotPasswordForm,
	safeReturnPath,
	signInDestination,
} from "#/lib/auth";
import { useMessages } from "#/lib/i18n";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/forgot-password")({
	// Carried over from sign-in: a reset signs in, then returns there.
	validateSearch: (search): { redirect?: string } => {
		const redirect = safeReturnPath(search.redirect);
		return redirect ? { redirect } : {};
	},
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const destination = signInDestination(redirect, authConfig.paths.afterAuth);
	const title = useMessages().auth.reset.title;

	return (
		<AuthCard title={title}>
			<ForgotPasswordForm
				onSuccess={() => navigate({ href: destination })}
				onBackToSignIn={() =>
					navigate({ href: authPageHref(authConfig.paths.signIn, redirect) })
				}
			/>
		</AuthCard>
	);
}
