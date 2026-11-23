import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AuthCard,
	SignUpForm,
	safeReturnPath,
	signInDestination,
} from "#/lib/auth";
import { useMessages } from "#/lib/i18n";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/sign-up")({
	// Carried over from sign-in, so a new account returns there too.
	validateSearch: (search): { redirect?: string } => {
		const redirect = safeReturnPath(search.redirect);
		return redirect ? { redirect } : {};
	},
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const destination = signInDestination(redirect, authConfig.paths.afterAuth);
	const title = useMessages().auth.signUp.title;

	return (
		<AuthCard title={title}>
			<SignUpForm
				redirect={redirect}
				onSuccess={() => navigate({ href: destination })}
			/>
		</AuthCard>
	);
}
