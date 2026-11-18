/**
 * Forgotten password in two steps on one screen: the email that receives the
 * code, then the code plus a new password. Success signs the person in, and
 * the `(auth)` layout dismisses the modal.
 *
 * The second step keeps the email as a read-only `username` field above the
 * new password, so password managers update the saved login for this account
 * instead of saving a second one.
 */
import { useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { AUTH_CODE_LENGTH, CodeField } from "../components/code-field";
import { EmailField } from "../components/email-field";
import { useAuthError } from "../components/use-auth-error";
import {
	NEW_PASSWORD_RULES,
	useCredentialText,
} from "../components/use-credential-text";
import { usePasswordReset } from "./use-password-reset";

export function PasswordResetScreen({
	initialEmail,
}: {
	initialEmail: string;
}) {
	const { t } = useI18n();
	const copy = t.auth.reset;
	const flow = usePasswordReset();
	const email = useCredentialText(initialEmail);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const password = useCredentialText();
	const error = useAuthError(flow.errorKey);

	if (!sentTo) {
		const ready = email.text.trim().length > 0;
		const send = async () => {
			const address = email.read().trim();
			if (address && (await flow.sendCode(address))) setSentTo(address);
		};
		return (
			<AuthForm title={copy.title} subtitle={copy.body} error={error}>
				<EmailField {...email.field(send)} returnKeyType="send" />
				<Button
					label={copy.sendCode}
					busy={flow.busy}
					disabled={!ready}
					onPress={send}
				/>
			</AuthForm>
		);
	}

	const ready = code.length === AUTH_CODE_LENGTH && password.text.length > 0;
	const submit = () => {
		const typed = password.read();
		if (code.length === AUTH_CODE_LENGTH && typed) flow.submit(code, typed);
	};
	return (
		<AuthForm
			title={copy.title}
			subtitle={fmt(copy.codeBody, { email: sentTo })}
			error={error}
		>
			<CodeField value={code} onChange={setCode} />
			<EmailField value={sentTo} editable={false} testID="reset-email" />
			<TextField
				label={copy.newPassword}
				{...password.field(submit)}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				passwordRules={NEW_PASSWORD_RULES}
				returnKeyType="go"
				testID="reset-new-password"
			/>
			<Button
				label={copy.submit}
				busy={flow.busy}
				disabled={!ready}
				onPress={submit}
			/>
		</AuthForm>
	);
}
