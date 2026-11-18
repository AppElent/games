/**
 * New account: first name (what other players see), email, password. A
 * successful create mails a code and moves on to `verify-email`.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { EmailField } from "../components/email-field";
import { useAuthError } from "../components/use-auth-error";
import {
	NEW_PASSWORD_RULES,
	useCredentialText,
} from "../components/use-credential-text";
import { useSignUp } from "./use-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signUp;
	const flow = useSignUp();
	const [firstName, setFirstName] = useState("");
	const email = useCredentialText();
	const password = useCredentialText();
	const emailRef = useRef<TextInputInstance>(null);
	const passwordRef = useRef<TextInputInstance>(null);
	const error = useAuthError(flow.errorKey);
	const ready = email.text.trim().length > 0 && password.text.length > 0;

	async function submit() {
		const [address, typed] = [email.read(), password.read()];
		if (!address.trim() || !typed) return;
		if (await flow.create({ email: address, password: typed, firstName })) {
			router.push({
				pathname: "/verify-email",
				params: { email: address.trim() },
			});
		}
	}

	return (
		<AuthForm
			title={copy.title}
			subtitle={copy.subtitle}
			error={error}
			footer={
				<Button
					variant="plain"
					label={`${copy.haveAccount} ${t.auth.signIn.submit}`}
					onPress={() => router.replace("/sign-in")}
				/>
			}
		>
			<TextField
				label={copy.firstName}
				value={firstName}
				onChangeText={setFirstName}
				autoComplete="given-name"
				textContentType="givenName"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => emailRef.current?.focus()}
			/>
			<EmailField
				ref={emailRef}
				{...email.field(() => passwordRef.current?.focus())}
				returnKeyType="next"
				submitBehavior="submit"
			/>
			<TextField
				ref={passwordRef}
				label={t.auth.signIn.password}
				{...password.field(submit)}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				passwordRules={NEW_PASSWORD_RULES}
				returnKeyType="go"
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
