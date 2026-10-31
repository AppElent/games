/**
 * The 6-digit code from a passwordless sign-in. The address arrives as a
 * route param only so the screen can say it back; the attempt itself lives on
 * Clerk's `signIn` resource.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { useEmailCodeSignIn } from "../../../auth/use-email-code-sign-in";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { useAuthError } from "../components/use-auth-error";

const CODE_LENGTH = 6;

export function SignInCodeScreen({ email }: { email: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.signInCode;
	const flow = useEmailCodeSignIn();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const error = useAuthError(flow.errorKey);
	const ready = code.length === CODE_LENGTH;

	return (
		<AuthForm
			title={copy.title}
			subtitle={fmt(copy.body, { email })}
			error={error}
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
			<TextField
				label={copy.code}
				value={code}
				onChangeText={(next) => setCode(next.replace(/\D/g, ""))}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={CODE_LENGTH}
				autoFocus
				returnKeyType="go"
				onSubmitEditing={() => ready && !flow.busy && flow.verify(code)}
			/>
			<Button
				label={copy.submit}
				busy={flow.busy}
				disabled={!ready}
				onPress={() => flow.verify(code)}
			/>
		</AuthForm>
	);
}
