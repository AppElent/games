import { useSignUp } from "@clerk/react";
import { useState } from "react";
import { authPageHref } from "#/lib/auth/core";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow } from "./clerkResult";
import { useAuthErrorText } from "./useAuthErrorText";

export function SignUpForm({
	onSuccess,
	redirect,
}: {
	onSuccess: () => void;
	/** The page to return to, kept on the link to sign-in. */
	redirect?: string;
}) {
	const { signUp } = useSignUp();
	const config = useAuthConfig();
	const copy = useMessages().auth;
	const errorText = useAuthErrorText();
	const [step, setStep] = useState<"details" | "verify">("details");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submitDetails(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signUp.password({ emailAddress: email, password }));
			await orThrow(signUp.verifications.sendEmailCode());
			setStep("verify");
		} catch (err) {
			setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	async function submitCode(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signUp.verifications.verifyEmailCode({ code }));
			if (signUp.status === "complete") {
				await orThrow(signUp.finalize());
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

	if (step === "verify") {
		return (
			<form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-[var(--auth-muted)]">
					{fmt(copy.verifyEmail.body, { email: email.trim() })}
				</p>
				<AuthField
					label={copy.signInCode.code}
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthButton loading={loading}>{copy.verifyEmail.submit}</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={submitDetails} noValidate className="flex flex-col gap-3">
			<AuthError message={error} />
			<AuthField
				label={copy.signIn.email}
				type="email"
				autoComplete="username"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthField
				label={copy.signIn.password}
				type="password"
				autoComplete="new-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton loading={loading}>{copy.signUp.submit}</AuthButton>
			<div className="mt-1 text-center text-xs text-[var(--auth-muted)]">
				<a
					href={authPageHref(config.paths.signIn, redirect)}
					className="hover:underline"
				>
					{copy.signUp.haveAccount} {copy.signIn.title}
				</a>
			</div>
		</form>
	);
}
