/**
 * The second step's fields and actions: an authenticator code, a texted or
 * emailed code, or a backup code, with a link to each other method the
 * account has. It sits in a screen or a sheet, which brings its own title and
 * way out; the rules live in `@arcadeclub/core/second-factor`.
 */
import {
	type SecondFactorFlow,
	type SecondFactorState,
	type SecondFactorStrategy,
	type SecondFactorUse,
	secondFactorInput,
	secondFactorMessage,
	secondFactorOpen,
	secondFactorPrompt,
	secondFactorReady,
	secondFactorSwitchLabel,
	sendsCode,
} from "@arcadeclub/core/second-factor";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { Notice } from "../../../ui/notice";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { CodeField } from "../components/code-field";
import { useCredentialForm } from "../components/use-credential-form";

type Props = {
	flow: SecondFactorFlow;
	state: SecondFactorState;
	/** Shown until the first action, such as after a password reset. */
	notice?: string | null;
	/** What the step ends, for its copy: a sign-in or a confirmation. */
	use?: SecondFactorUse;
	/** Names what a verified code goes on to do; "Verify" by default. */
	submitLabel?: string;
};

export function SecondFactorStep({
	flow,
	state,
	notice = null,
	use = "signIn",
	submitLabel,
}: Props) {
	const { locale, t } = useI18n();
	const [opening, setOpening] = useState(notice);
	const [resends, setResends] = useState(0);
	const { strategy, options, busy, ended } = state;
	const open = secondFactorOpen(state);
	const option = options.find((o) => o.strategy === strategy);
	const others = ended ? [] : options.filter((o) => o !== option);

	return (
		<>
			{open && option ? (
				<AppText variant="secondary">{secondFactorPrompt(t, option)}</AppText>
			) : null}
			{open && strategy ? (
				<CodeEntry
					// A new code starts with an empty field.
					key={`${strategy}-${resends}`}
					strategy={strategy}
					busy={busy}
					submitLabel={submitLabel}
					onSubmit={(code) => {
						setOpening(null);
						void flow.verify(code);
					}}
				>
					<Notice message={secondFactorMessage(t, locale, state, use)} />
					<Notice
						message={state.resent ? t.auth.signInCode.resent : opening}
						tone="info"
					/>
				</CodeEntry>
			) : (
				<Notice message={secondFactorMessage(t, locale, state, use)} />
			)}
			{!ended && strategy && sendsCode(strategy) ? (
				<Button
					variant="plain"
					label={t.auth.signInCode.resend}
					busy={busy === "send"}
					disabled={busy !== null}
					onPress={async () => {
						setOpening(null);
						if (await flow.resend()) setResends((n) => n + 1);
					}}
					testID="second-factor-resend"
				/>
			) : null}
			{others.map((other) => (
				<Button
					key={other.strategy}
					variant="plain"
					label={secondFactorSwitchLabel(t, other)}
					disabled={busy !== null}
					onPress={() => {
						setOpening(null);
						void flow.switchTo(other.strategy);
					}}
					testID={`second-factor-use-${other.strategy}`}
				/>
			))}
		</>
	);
}

function CodeEntry({
	strategy,
	busy,
	submitLabel,
	onSubmit,
	children,
}: {
	strategy: SecondFactorStrategy;
	busy: SecondFactorState["busy"];
	submitLabel?: string;
	onSubmit: (code: string) => void;
	children: React.ReactNode;
}) {
	const { t } = useI18n();
	const copy = t.auth.secondFactor;
	const form = useCredentialForm({ code: "" });
	const clean = (text: string) => secondFactorInput(strategy, text);
	const submit = ({ code }: typeof form.values) => {
		if (!busy && secondFactorReady(strategy, code)) onSubmit(code);
	};
	return (
		<>
			{strategy === "backup_code" ? (
				<TextField
					label={copy.backupCode}
					{...form.field("code", clean)}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="off"
					textContentType="none"
					autoFocus
					returnKeyType="go"
					onSubmitEditing={form.submitFrom("code", submit)}
					testID="second-factor-code"
				/>
			) : (
				<CodeField
					{...form.field("code", clean)}
					// `clean` limits it, so a pasted "123 456" keeps every digit.
					maxLength={undefined}
					onSubmitEditing={() => submit(form.values)}
					testID="second-factor-code"
				/>
			)}
			{children}
			<Button
				label={submitLabel ?? copy.submit}
				busy={busy === "verify"}
				disabled={
					busy !== null ||
					(!secondFactorReady(strategy, form.values.code) && !form.editing)
				}
				onPress={() => form.press(submit)}
				testID="second-factor-submit"
			/>
		</>
	);
}
