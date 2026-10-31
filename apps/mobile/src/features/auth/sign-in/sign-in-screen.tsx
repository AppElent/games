/**
 * Email and password, or an emailed code (`sign-in-code`). The submit does
 * not navigate: `finalize()` flips `isSignedIn` and the `(auth)` layout
 * dismisses the whole modal, returning to whatever asked for sign-in.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { devLogin } from "../../../auth/config";
import { useEmailCodeSignIn } from "../../../auth/use-email-code-sign-in";
import { usePasswordSignIn } from "../../../auth/use-password-sign-in";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { useAuthError } from "../components/use-auth-error";

export function SignInScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signIn;
	const password = usePasswordSignIn();
	const emailCode = useEmailCodeSignIn();
	const [hint, setHint] = useState<string | null>(null);
	const [email, setEmail] = useState(devLogin?.email ?? "");
	const [secret, setSecret] = useState(devLogin?.password ?? "");
	const passwordRef = useRef<TextInputInstance>(null);
	const passwordError = useAuthError(password.errorKey);
	const codeError = useAuthError(emailCode.errorKey);

	const ready = email.trim().length > 0 && secret.length > 0;
	const submit = () => {
		setHint(null);
		if (ready) password.submit(email, secret);
	};

	async function sendCode() {
		setHint(null);
		if (!email.trim()) {
			setHint(copy.emailFirst);
			return;
		}
		if (await emailCode.send(email)) {
			router.push({
				pathname: "/sign-in-code",
				params: { email: email.trim() },
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
								params: email.trim() ? { email: email.trim() } : {},
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
			<TextField
				label={copy.email}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				autoComplete="email"
				textContentType="username"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
				testID="sign-in-email"
			/>
			<TextField
				ref={passwordRef}
				label={copy.password}
				value={secret}
				onChangeText={setSecret}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={submit}
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
