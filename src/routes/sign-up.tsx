import { AuthCard, SignUpForm } from "@appelent/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/sign-up")({
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();

	return (
		<AuthCard title="Create an account">
			<SignUpForm
				onSuccess={() => navigate({ to: authConfig.paths.afterAuth })}
			/>
		</AuthCard>
	);
}
