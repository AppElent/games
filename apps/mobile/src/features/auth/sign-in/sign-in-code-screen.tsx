/**
 * The 6-digit code from a passwordless sign-in. The address arrives as a
 * route param only so the screen can say it back; the attempt itself lives on
 * Clerk's `signIn` resource.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { AuthForm } from "../components/auth-form";
import { AUTH_CODE_LENGTH, CodeField } from "../components/code-field";
import { useAuthError } from "../components/use-auth-error";
import { useOpenSecondFactor } from "../second-factor/use-open-second-factor";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";

export function SignInCodeScreen({ email }: { email: string }) {
	const router = useRouter();
	const openSecondFactor = useOpenSecondFactor();
	const { t } = useI18n();
	const copy = t.auth.signInCode;
	const flow = useEmailCodeSignIn();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const error = useAuthError(flow.errorKey);
	const ready = code.length === AUTH_CODE_LENGTH;

	async function verify() {
		if (!ready || flow.busy) return;
		// Replaces this screen: its code is spent, so there is no way back to it.
		if ((await flow.verify(code)) === "secondFactor") {
			openSecondFactor("replace");
		}
	}

	return (
		<AuthForm
			title={copy.title}
			subtitle={fmt(copy.body, { email })}
			error={error ?? (flow.unsupported ? t.auth.signIn.unsupportedStep : null)}
			notice={notice}
			footer={
				<>
					<Button
						variant="plain"
						label={copy.resend}
						disabled={flow.resending}
						onPress={async () => {
							setNotice(null);
							if (await flow.resend()) setNotice(copy.resent);
						}}
					/>
					<Button
						variant="plain"
						label={copy.differentEmail}
						onPress={async () => {
							await flow.startOver();
							router.back();
						}}
					/>
				</>
			}
		>
			<CodeField value={code} onChangeText={setCode} onSubmitEditing={verify} />
			<Button
				label={copy.submit}
				busy={flow.busy}
				disabled={!ready}
				onPress={verify}
			/>
		</AuthForm>
	);
}
