import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, SignInForm } from "#/lib/auth";
import { useMessages } from "#/lib/i18n";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/sign-in")({
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const title = useMessages().auth.signIn.title;

	return (
		<AuthCard title={title}>
			<SignInForm
				onSuccess={() => navigate({ to: authConfig.paths.afterAuth })}
			/>
		</AuthCard>
	);
}
