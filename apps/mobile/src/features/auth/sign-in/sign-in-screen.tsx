/**
 * Email and password, or an emailed code (`sign-in-code`). The submit does
 * not navigate: `finalize()` flips `isSignedIn` and the `(auth)` layout
 * dismisses the whole modal, returning to whatever asked for sign-in.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { devLogin } from "../../../auth/config";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { EmailField } from "../components/email-field";
import { useAuthError } from "../components/use-auth-error";
import { useCredentialText } from "../components/use-credential-text";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";
import { usePasswordSignIn } from "./use-password-sign-in";

export function SignInScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signIn;
	const password = usePasswordSignIn();
	const emailCode = useEmailCodeSignIn();
	const [hint, setHint] = useState<string | null>(null);
	const email = useCredentialText(devLogin?.email ?? "");
	const secret = useCredentialText(devLogin?.password ?? "");
	const passwordRef = useRef<TextInputInstance>(null);
	const passwordError = useAuthError(password.errorKey);
	const codeError = useAuthError(emailCode.errorKey);

	const ready = email.text.trim().length > 0 && secret.text.length > 0;
	const submit = () => {
		setHint(null);
		const [address, typed] = [email.read(), secret.read()];
		if (address.trim() && typed) password.submit(address, typed);
	};

	async function sendCode() {
		setHint(null);
		const address = email.read().trim();
		if (!address) {
			setHint(copy.emailFirst);
			return;
		}
		if (await emailCode.send(address)) {
			router.push({
				pathname: "/sign-in-code",
				params: { email: address },
			});
		}
	}

	return (
		<AuthForm
			title={copy.title}
			subtitle={copy.subtitle}
			error={
				hint ??
				codeError ??
				passwordError ??
				(password.unsupported ? copy.unsupportedStep : null)
			}
			footer={
				<>
					<Button variant="plain" label={copy.emailCode} onPress={sendCode} />
					<Button
						variant="plain"
						label={copy.forgotPassword}
						onPress={() =>
							router.push({
								pathname: "/reset",
								params: email.read().trim()
									? { email: email.read().trim() }
									: {},
							})
						}
					/>
					<Button
						variant="plain"
						label={`${copy.noAccount} ${copy.createAccount}`}
						onPress={() => router.replace("/sign-up")}
					/>
					{devLogin ? (
						<AppText variant="caption">{copy.devNote}</AppText>
					) : null}
				</>
			}
		>
			<EmailField
				{...email.field(() => passwordRef.current?.focus())}
				returnKeyType="next"
				submitBehavior="submit"
				testID="sign-in-email"
			/>
			<TextField
				ref={passwordRef}
				label={copy.password}
				{...secret.field(submit)}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				testID="sign-in-password"
			/>
			<Button
				label={copy.submit}
				busy={password.busy || emailCode.busy}
				disabled={!ready}
				onPress={submit}
				testID="sign-in-submit"
			/>
		</AuthForm>
	);
}
