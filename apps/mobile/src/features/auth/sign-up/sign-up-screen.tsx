/**
 * New account: first name (what other players see), email, password. A
 * successful create mails a code and moves on to `verify-email`.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useSignUp } from "../../../auth/use-sign-up";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { useAuthError } from "../components/use-auth-error";

export function SignUpScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signUp;
	const flow = useSignUp();
	const [firstName, setFirstName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const emailRef = useRef<TextInputInstance>(null);
	const passwordRef = useRef<TextInputInstance>(null);
	const error = useAuthError(flow.errorKey);
	const ready = email.trim().length > 0 && password.length > 0;

	async function submit() {
		if (!ready) return;
		if (await flow.create({ email, password, firstName })) {
			router.push({
				pathname: "/verify-email",
				params: { email: email.trim() },
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
			<TextField
				ref={emailRef}
				label={t.auth.signIn.email}
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
			/>
			<TextField
				ref={passwordRef}
				label={t.auth.signIn.password}
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
