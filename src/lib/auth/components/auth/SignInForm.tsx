import { clerkErrorKey } from "@arcadeclub/core/auth-errors";
import { useSignIn } from "@clerk/react";
import { useEffect, useId, useRef, useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow } from "./clerkResult";
import { TestLoginButton } from "./TestLoginButton";
import { EMAIL_CODE_LENGTH, useEmailCodeSignIn } from "./useEmailCodeSignIn";

/**
 * Email and password, or an emailed code for accounts that have no password
 * (made on the phone with a code). The code step replaces the password step
 * on the same screen; "Use a different email" drops the attempt and returns.
 */
export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
	const { signIn } = useSignIn();
	const config = useAuthConfig();
	const copy = useMessages().auth;
	const emailCode = useEmailCodeSignIn();
	const [step, setStep] = useState<"password" | "code">("password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const codeRef = useRef<HTMLInputElement>(null);
	const stepShown = useRef(step);
	const codeBodyId = useId();
	const codeErrorId = useId();

	// Focus follows the step, but not on first render.
	useEffect(() => {
		if (stepShown.current === step) return;
		stepShown.current = step;
		(step === "code" ? codeRef : emailRef).current?.focus();
	}, [step]);

	const codeError = emailCode.errorKey ? copy.errors[emailCode.errorKey] : null;
	const busy = loading || emailCode.busy !== null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		emailCode.clearError();
		setLoading(true);
		try {
			await orThrow(signIn.password({ identifier: email, password }));
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess();
			} else {
				setError(copy.errors.unsupportedStep);
			}
		} catch (err) {
			setError(copy.errors[clerkErrorKey(err) ?? "generic"]);
		} finally {
			setLoading(false);
		}
	}

	async function sendCode() {
		setError(null);
		if (!email.trim()) {
			emailCode.clearError();
			setError(copy.signIn.emailFirst);
			emailRef.current?.focus();
			return;
		}
		if (await emailCode.send(email)) {
			setCode("");
			setNotice(null);
			setStep("code");
		} else {
			emailRef.current?.focus();
		}
	}

	async function verifyCode(e: React.FormEvent) {
		e.preventDefault();
		setNotice(null);
		if (await emailCode.verify(code)) {
			onSuccess();
		} else {
			codeRef.current?.focus();
		}
	}

	async function resendCode() {
		setNotice(null);
		if (await emailCode.resend()) {
			setNotice(copy.signInCode.resent);
		}
		codeRef.current?.focus();
	}

	async function changeEmail() {
		await emailCode.startOver();
		setCode("");
		setNotice(null);
		setStep("password");
	}

	if (step === "code") {
		return (
			<form onSubmit={verifyCode} noValidate className="flex flex-col gap-3">
				<div className="text-sm text-[var(--auth-fg)]">
					<p className="font-medium">{copy.signInCode.title}</p>
					<p id={codeBodyId} className="mt-1 text-[var(--auth-muted)]">
						{fmt(copy.signInCode.body, { email: email.trim() })}
					</p>
				</div>
				<AuthError id={codeErrorId} message={codeError} />
				<p
					role="status"
					className="text-sm text-[var(--auth-muted)] empty:hidden"
				>
					{notice}
				</p>
				<AuthField
					label={copy.signInCode.code}
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					inputRef={codeRef}
					describedBy={codeError ? `${codeBodyId} ${codeErrorId}` : codeBodyId}
					invalid={codeError !== null}
					value={code}
					onChange={(value) =>
						setCode(value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH))
					}
					required
				/>
				<AuthButton
					loading={emailCode.busy === "verify"}
					busyLabel={copy.signIn.busy}
					disabled={busy || code.length !== EMAIL_CODE_LENGTH}
				>
					{copy.signInCode.submit}
				</AuthButton>
				<AuthButton
					type="button"
					variant="secondary"
					loading={emailCode.busy === "resend"}
					busyLabel={copy.signIn.busy}
					disabled={busy}
					onClick={resendCode}
				>
					{copy.signInCode.resend}
				</AuthButton>
				<button
					type="button"
					disabled={busy}
					onClick={changeEmail}
					className="self-center px-3 py-2 text-xs text-[var(--auth-muted)] hover:underline disabled:opacity-60"
				>
					{copy.signInCode.differentEmail}
				</button>
			</form>
		);
	}

	return (
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
			<AuthError message={error ?? codeError} />
			<AuthField
				label={copy.signIn.email}
				type="email"
				autoComplete="username"
				inputRef={emailRef}
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthField
				label={copy.signIn.password}
				type="password"
				autoComplete="current-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton
				loading={loading}
				busyLabel={copy.signIn.busy}
				disabled={busy}
			>
				{copy.signIn.submit}
			</AuthButton>
			<AuthButton
				type="button"
				variant="secondary"
				loading={emailCode.busy === "send"}
				busyLabel={copy.signIn.busy}
				disabled={busy}
				onClick={sendCode}
			>
				{copy.signIn.emailCode}
			</AuthButton>
			<TestLoginButton onSuccess={onSuccess} />
			<div className="mt-1 flex justify-between text-xs text-[var(--auth-muted)]">
				{config.features.forgotPassword ? (
					<a href={config.paths.forgotPassword} className="hover:underline">
						{copy.signIn.forgotPassword}
					</a>
				) : (
					<span />
				)}
				<a href={config.paths.signUp} className="hover:underline">
					{copy.signIn.createAccount}
				</a>
			</div>
		</form>
	);
}
