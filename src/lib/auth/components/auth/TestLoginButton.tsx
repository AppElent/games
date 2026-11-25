import { needsSecondFactor } from "@arcadeclub/core/second-factor";
import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { shouldShowTestLogin } from "#/lib/auth/core";
import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { orThrow } from "./clerkResult";
import { useAuthErrorText } from "./useAuthErrorText";

export function TestLoginButton({
	onSuccess,
	onSecondFactor,
	disabled,
}: {
	onSuccess: () => void;
	onSecondFactor: () => void;
	/** Another sign-in request is running on the same form. */
	disabled?: boolean;
}) {
	const { signIn } = useSignIn();
	const copy = useMessages().auth;
	const errorText = useAuthErrorText();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!shouldShowTestLogin(import.meta.env)) {
		return null;
	}

	async function loginTestUser() {
		setError(null);
		setLoading(true);
		try {
			await orThrow(
				signIn.password({
					identifier: import.meta.env.VITE_TEST_USER_EMAIL as string,
					password: import.meta.env.VITE_TEST_USER_PASSWORD as string,
				}),
			);
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess();
			} else if (needsSecondFactor(signIn.status)) {
				onSecondFactor();
			} else {
				setError(copy.errors.unsupportedStep);
			}
		} catch (err) {
			setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton
				type="button"
				variant="ghost"
				loading={loading}
				disabled={disabled}
				onClick={loginTestUser}
			>
				▶ Dev: log in as test user
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}
