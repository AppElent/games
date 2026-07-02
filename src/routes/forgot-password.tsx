import { AuthCard, ForgotPasswordForm } from "@appelent/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();

	return (
		<AuthCard title="Reset your password">
			<ForgotPasswordForm
				onSuccess={() => navigate({ to: authConfig.paths.afterAuth })}
			/>
		</AuthCard>
	);
}
