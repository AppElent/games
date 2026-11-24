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
import {
	AUTH_CODE_LENGTH,
	CodeField,
	codeDigits,
} from "../components/code-field";
import { EmailField } from "../components/email-field";
import { useAuthError } from "../components/use-auth-error";
import {
	NEW_PASSWORD_RULES,
	useCredentialForm,
} from "../components/use-credential-form";
import { useOpenSecondFactor } from "../second-factor/use-open-second-factor";
import { usePasswordReset } from "./use-password-reset";

export function PasswordResetScreen({
	initialEmail,
}: {
	initialEmail: string;
}) {
	const openSecondFactor = useOpenSecondFactor();
	const { t } = useI18n();
	const copy = t.auth.reset;
	const flow = usePasswordReset();
	const request = useCredentialForm({ email: initialEmail });
	const [sentTo, setSentTo] = useState<string | null>(null);
	const reset = useCredentialForm({ code: "", password: "" });
	const error = useAuthError(flow.errorKey);

	if (!sentTo) {
		const ready = request.values.email.trim().length > 0;
		const send = async ({ email }: typeof request.values) => {
			const address = email.trim();
			if (address && (await flow.sendCode(address))) setSentTo(address);
		};
		return (
			<AuthForm title={copy.title} subtitle={copy.body} error={error}>
				<EmailField
					{...request.field("email")}
					onSubmitEditing={request.submitFrom("email", send)}
					returnKeyType="send"
				/>
				<Button
					label={copy.sendCode}
					busy={flow.busy}
					disabled={!ready && !request.editing}
					onPress={() => request.press(send)}
				/>
			</AuthForm>
		);
	}

	const ready =
		reset.values.code.length === AUTH_CODE_LENGTH &&
		reset.values.password.length > 0;
	const submit = async ({ code, password }: typeof reset.values) => {
		if (code.length !== AUTH_CODE_LENGTH || !password) return;
		// Replaces this screen: its code is spent, so there is no way back to it.
		if ((await flow.submit(code, password)) === "secondFactor") {
			openSecondFactor("replace", {
				pathname: "/sign-in-second-factor",
				params: { from: "reset" },
			});
		}
	};
	return (
		<AuthForm
			title={copy.title}
			subtitle={fmt(copy.codeBody, { email: sentTo })}
			error={error ?? (flow.unsupported ? t.auth.errors.unsupportedStep : null)}
		>
			<CodeField {...reset.field("code", codeDigits)} />
			<EmailField value={sentTo} editable={false} testID="reset-email" />
			<TextField
				label={copy.newPassword}
				{...reset.field("password")}
				onSubmitEditing={reset.submitFrom("password", submit)}
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
				disabled={!ready && !reset.editing}
				onPress={() => reset.press(submit)}
			/>
		</AuthForm>
	);
}
