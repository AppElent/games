/**
 * Forgotten password in two steps on one screen: the email that receives the
 * code, then the code plus a new password. Success signs the person in, and
 * the `(auth)` layout dismisses the modal.
 */
import { useState } from "react";
import { usePasswordReset } from "../../../auth/use-password-reset";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { useAuthError } from "../components/use-auth-error";

export function PasswordResetScreen({
	initialEmail,
}: {
	initialEmail: string;
}) {
	const { t } = useI18n();
	const copy = t.auth.reset;
	const flow = usePasswordReset();
	const [email, setEmail] = useState(initialEmail);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const error = useAuthError(flow.errorKey);

	if (!sentTo) {
		const ready = email.trim().length > 0;
		const send = async () => {
			if (ready && (await flow.sendCode(email))) setSentTo(email.trim());
		};
		return (
			<AuthForm title={copy.title} subtitle={copy.body} error={error}>
				<TextField
					label={t.auth.signIn.email}
					value={email}
					onChangeText={setEmail}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="email-address"
					autoComplete="email"
					textContentType="username"
					returnKeyType="send"
					onSubmitEditing={send}
				/>
				<Button
					label={copy.sendCode}
					busy={flow.busy}
					disabled={!ready}
					onPress={send}
				/>
			</AuthForm>
		);
	}

	const ready = code.length === 6 && password.length > 0;
	const submit = () => ready && flow.submit(code, password);
	return (
		<AuthForm
			title={copy.title}
			subtitle={fmt(copy.codeBody, { email: sentTo })}
			error={error}
		>
			<TextField
				label={t.auth.signInCode.code}
				value={code}
				onChangeText={(next) => setCode(next.replace(/\D/g, ""))}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={6}
				autoFocus
			/>
			<TextField
				label={copy.newPassword}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={submit}
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
