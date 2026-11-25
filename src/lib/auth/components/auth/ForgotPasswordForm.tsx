import { needsSecondFactor } from "@arcadeclub/core/second-factor";
import { useSignIn } from "@clerk/react";
import { useRef, useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow } from "./clerkResult";
import { SecondFactorStep } from "./SecondFactorStep";
import { useResumeSecondFactor } from "./secondFactorResume";
import { UsernameHint } from "./UsernameHint";
import { useAuthErrorText } from "./useAuthErrorText";
import { useSignInAttempt } from "./useSignInAttempt";

export function ForgotPasswordForm({
	onSuccess,
	onBackToSignIn,
}: {
	onSuccess: () => void;
	/** Leaves the second step an account with two-step verification gets. */
	onBackToSignIn: () => void;
}) {
	const { signIn } = useSignIn();
	const copy = useMessages().auth;
	const errorText = useAuthErrorText();
	const begin = useSignInAttempt();
	const [step, setStep] = useState<"request" | "reset" | "secondFactor">(
		"request",
	);
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	/** The attempt the code was emailed for; an earlier answer can replace it. */
	const emailed = useRef<string | undefined>(undefined);
	const resuming = useResumeSecondFactor(() => setStep("secondFactor"));

	async function requestCode(e: React.FormEvent) {
		e.preventDefault();
		const attempt = begin();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signIn.create({ identifier: email }));
			// Nobody is left to use the code.
			if (!attempt.isShown()) return;
			await orThrow(signIn.resetPasswordEmailCode.sendCode());
			if (!attempt.isLatest()) return;
			emailed.current = signIn.id;
			setStep("reset");
		} catch (err) {
			if (attempt.isLatest()) setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	async function resetPassword(e: React.FormEvent) {
		e.preventDefault();
		const attempt = begin();
		setError(null);
		setLoading(true);
		try {
			if (signIn.id !== emailed.current) {
				setStep("request");
				setError(copy.errors.codeExpired);
				return;
			}
			await orThrow(signIn.resetPasswordEmailCode.verifyCode({ code }));
			if (!attempt.isLatest()) return;
			await orThrow(signIn.resetPasswordEmailCode.submitPassword({ password }));
			if (!attempt.isLatest()) return;
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				if (attempt.isShown()) onSuccess();
			} else if (needsSecondFactor(signIn.status)) {
				setStep("secondFactor");
			} else {
				setError(copy.errors.unsupportedStep);
			}
		} catch (err) {
			if (attempt.isLatest()) setError(errorText(err));
		} finally {
			setLoading(false);
		}
	}

	if (resuming) {
		return (
			<p role="status" className="text-center text-sm text-[var(--auth-muted)]">
				{copy.signIn.busy}
			</p>
		);
	}

	if (step === "secondFactor") {
		return (
			<SecondFactorStep
				notice={copy.secondFactor.passwordChanged}
				onSuccess={onSuccess}
				onBack={onBackToSignIn}
			/>
		);
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
