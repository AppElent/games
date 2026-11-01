import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, SignInForm } from "#/lib/auth";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/sign-in")({
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();

	return (
		<AuthCard title="Sign in">
			<SignInForm
				onSuccess={() => navigate({ to: authConfig.paths.afterAuth })}
			/>
		</AuthCard>
	);
}
