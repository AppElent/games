import {
	createSecondFactorFlow,
	secondFactorInput,
	secondFactorMessage,
	secondFactorOpen,
	secondFactorPrompt,
	secondFactorReady,
	secondFactorSwitchLabel,
	sendsCode,
	signInSecondFactor,
} from "@arcadeclub/core/second-factor";
import { useSignIn } from "@clerk/react";
import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useI18n } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { useRememberSecondFactor } from "./secondFactorResume";
import { type SignInAttempt, useSignInAttempt } from "./useSignInAttempt";

/**
 * The second step of a sign-in: an authenticator code, a texted or emailed
 * code, or a backup code. Every way into a sign-in (password, emailed code,
 * password reset) opens it on the same screen. Each other method the account
 * has is a link; going back drops the attempt, so the next sign-in starts
 * clean. A reload reopens it on the method it was on, without a new code; an
 * attempt another sign-in took over ends it. The rules live in `@arcadeclub/core/second-factor`.
 */
export function SecondFactorStep({
	onSuccess,
	onBack,
	notice = null,
}: {
	onSuccess: () => void;
	onBack: () => void;
	/** Shown until the first action, such as after a password reset. */
	notice?: string | null;
}) {
	const { signIn } = useSignIn();
	const { messages, locale } = useI18n();
	const copy = messages.auth.secondFactor;
	const live = useRef(signIn);
	live.current = signIn;
	const begin = useSignInAttempt();
	const [id] = useState(signIn.id);
	const attempt = useRef<SignInAttempt | null>(null);
	const [flow] = useState(() => {
		return createSecondFactorFlow(
			signIn.supportedSecondFactors,
			signInSecondFactor(
				() => live.current,
				() => live.current.id === id && (attempt.current?.isLatest() ?? true),
			),
			false,
			signIn.secondFactorVerification?.strategy,
		);
	});
	useRememberSecondFactor(id);
	const state = useSyncExternalStore(
		flow.subscribe,
		flow.getState,
		flow.getState,
	);
	const [code, setCode] = useState("");
	const [opening, setOpening] = useState(notice);
	const fieldRef = useRef<HTMLInputElement>(null);
	const closedRef = useRef<HTMLDivElement>(null);
	const promptId = useId();
	const errorId = useId();
	const { strategy, options, busy } = state;
	const open = secondFactorOpen(state);

	useEffect(() => flow.start(), [flow]);

	// Focus follows the step: its field, or the message once the field is gone.
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new method has a new field.
	useEffect(() => {
		(open ? fieldRef : closedRef).current?.focus();
	}, [open, strategy]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setOpening(null);
		const current = begin();
		attempt.current = current;
		if (await flow.verify(code)) {
			if (current.isShown()) onSuccess();
		} else (fieldRef.current ?? closedRef.current)?.focus();
	}

	async function act(action: Promise<boolean>) {
		setOpening(null);
		if (await action) setCode("");
		(fieldRef.current ?? closedRef.current)?.focus();
	}

	async function back() {
		try {
			await signIn.reset();
		} catch {
			// The next sign-in starts a new attempt either way.
		}
		onBack();
	}

	const option = options.find((o) => o.strategy === strategy);
	const message = secondFactorMessage(messages, locale, state);
	const others = state.ended ? [] : options.filter((o) => o !== option);
	const showResend = !state.ended && strategy !== null && sendsCode(strategy);

	return (
		<form onSubmit={submit} noValidate className="flex flex-col gap-3">
			<div
				ref={closedRef}
				tabIndex={-1}
				className="flex flex-col gap-3 text-sm text-[var(--auth-fg)] outline-none"
			>
				<div>
					<h2 className="font-medium">{copy.title}</h2>
					{open && option ? (
						<p id={promptId} className="mt-1 text-[var(--auth-muted)]">
							{secondFactorPrompt(messages, option)}
						</p>
					) : null}
				</div>
				<AuthError id={errorId} message={message} />
			</div>
			<p
				role="status"
				className="text-sm text-[var(--auth-muted)] empty:hidden"
			>
				{state.resent ? messages.auth.signInCode.resent : opening}
			</p>
			{open && strategy ? (
				<>
					<AuthField
						key={strategy}
						label={
							strategy === "backup_code"
								? copy.backupCode
								: messages.auth.signInCode.code
						}
						type="text"
						inputMode={strategy === "backup_code" ? "text" : "numeric"}
						autoComplete={strategy === "backup_code" ? "off" : "one-time-code"}
						inputRef={fieldRef}
						describedBy={message ? `${promptId} ${errorId}` : promptId}
						invalid={message !== null}
						value={code}
						onChange={(value) => setCode(secondFactorInput(strategy, value))}
						required
					/>
					<AuthButton
						loading={busy === "verify"}
						disabled={busy !== null || !secondFactorReady(strategy, code)}
					>
						{copy.submit}
					</AuthButton>
				</>
			) : null}
			{showResend ? (
				<AuthButton
					type="button"
					variant="secondary"
					loading={busy === "send"}
					disabled={busy !== null}
					onClick={() => act(flow.resend())}
				>
					{messages.auth.signInCode.resend}
				</AuthButton>
			) : null}
			{others.map((other) => (
				<AuthButton
					key={other.strategy}
					type="button"
					variant="secondary"
					disabled={busy !== null}
					onClick={() => act(flow.switchTo(other.strategy))}
				>
					{secondFactorSwitchLabel(messages, other)}
				</AuthButton>
			))}
			<button
				type="button"
				disabled={busy !== null}
				onClick={back}
				className="self-center px-3 py-2 text-xs text-[var(--auth-muted)] hover:underline disabled:opacity-60"
			>
				{copy.backToSignIn}
			</button>
		</form>
	);
}
