/**
 * New account: first name (what other players see), email, password. A
 * successful create mails a code and moves on to `verify-email`.
 */
import { useRouter } from "expo-router";
import { useRef } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { EmailField } from "../components/email-field";
import { useAuthError } from "../components/use-auth-error";
import {
	NEW_PASSWORD_RULES,
	useCredentialForm,
} from "../components/use-credential-form";
import { useSignUp } from "./use-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signUp;
	const flow = useSignUp();
	const form = useCredentialForm({ firstName: "", email: "", password: "" });
	const emailRef = useRef<TextInputInstance>(null);
	const passwordRef = useRef<TextInputInstance>(null);
	const error = useAuthError(flow.errorKey);
	const ready =
		form.values.email.trim().length > 0 && form.values.password.length > 0;

	async function submit(values: typeof form.values) {
		if (!values.email.trim() || !values.password) return;
		if (await flow.create(values)) {
			router.push({
				pathname: "/verify-email",
				params: { email: values.email.trim() },
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
				{...form.field("firstName")}
				autoComplete="given-name"
				textContentType="givenName"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => emailRef.current?.focus()}
			/>
			<EmailField
				ref={emailRef}
				{...form.field("email")}
				onSubmitEditing={() => passwordRef.current?.focus()}
				returnKeyType="next"
				submitBehavior="submit"
			/>
			<TextField
				ref={passwordRef}
				label={t.auth.signIn.password}
				{...form.field("password")}
				onSubmitEditing={form.submitFrom("password", submit)}
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
				disabled={!ready && !form.editing}
				onPress={() => form.press(submit)}
			/>
		</AuthForm>
	);
}
