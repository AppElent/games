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
import { useCredentialForm } from "../components/use-credential-form";
import { useOpenSecondFactor } from "../second-factor/use-open-second-factor";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";
import { usePasswordSignIn } from "./use-password-sign-in";

export function SignInScreen() {
	const router = useRouter();
	const openSecondFactor = useOpenSecondFactor();
	const { t } = useI18n();
	const copy = t.auth.signIn;
	const password = usePasswordSignIn();
	const emailCode = useEmailCodeSignIn();
	const [hint, setHint] = useState<string | null>(null);
	const form = useCredentialForm({
		email: devLogin?.email ?? "",
		password: devLogin?.password ?? "",
	});
	const passwordRef = useRef<TextInputInstance>(null);
	const passwordError = useAuthError(password.error);
	const codeError = useAuthError(emailCode.error);

	const ready =
		form.values.email.trim().length > 0 && form.values.password.length > 0;
	async function submit(values: typeof form.values) {
		setHint(null);
		if (!values.email.trim() || !values.password) return;
		const outcome = await password.submit(values.email, values.password);
		if (outcome === "secondFactor") openSecondFactor("push");
	}

	async function sendCode(values: typeof form.values) {
		setHint(null);
		const address = values.email.trim();
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
					<Button
						variant="plain"
						label={copy.emailCode}
						onPress={() => form.press(sendCode)}
					/>
					<Button
						variant="plain"
						label={copy.forgotPassword}
						onPress={() =>
							form.press(({ email }) =>
								router.push({
									pathname: "/reset",
									params: email.trim() ? { email: email.trim() } : {},
								}),
							)
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
				{...form.field("email")}
				onSubmitEditing={() => passwordRef.current?.focus()}
				returnKeyType="next"
				submitBehavior="submit"
				testID="sign-in-email"
			/>
			<TextField
				ref={passwordRef}
				label={copy.password}
				{...form.field("password")}
				onSubmitEditing={form.submitFrom("password", submit)}
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
				disabled={!ready && !form.editing}
				onPress={() => form.press(submit)}
				testID="sign-in-submit"
			/>
		</AuthForm>
	);
}
