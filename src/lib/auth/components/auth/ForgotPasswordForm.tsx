import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow } from "./clerkResult";
import { UsernameHint } from "./UsernameHint";
import { useAuthErrorText } from "./useAuthErrorText";

export function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
	const { signIn } = useSignIn();
	const copy = useMessages().auth;
	const errorText = useAuthErrorText();
	const [step, setStep] = useState<"request" | "reset">("request");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function requestCode(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signIn.create({ identifier: email }));
			await orThrow(signIn.resetPasswordEmailCode.sendCode());
			setStep("reset");
		} catch (err) {
			setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	async function resetPassword(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signIn.resetPasswordEmailCode.verifyCode({ code }));
			await orThrow(signIn.resetPasswordEmailCode.submitPassword({ password }));
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess();
			} else {
				setError(copy.errors.unsupportedStep);
			}
		} catch (err) {
			setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	if (step === "reset") {
		return (
			<form onSubmit={resetPassword} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-[var(--auth-muted)]">
					{fmt(copy.reset.codeBody, { email: email.trim() })}
				</p>
				<UsernameHint username={email} />
				<AuthField
					label={copy.signInCode.code}
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthField
					label={copy.reset.newPassword}
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={setPassword}
					required
				/>
				<AuthButton loading={loading}>{copy.reset.submit}</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={requestCode} noValidate className="flex flex-col gap-3">
			<AuthError message={error} />
			<p className="text-sm text-[var(--auth-muted)]">{copy.reset.body}</p>
			<AuthField
				label={copy.signIn.email}
				type="email"
				autoComplete="username"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthButton loading={loading}>{copy.reset.sendCode}</AuthButton>
		</form>
	);
}
