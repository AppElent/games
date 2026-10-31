/** The 6-digit code that proves the new account's address. */
import { useState } from "react";
import { useSignUp } from "../../../auth/use-sign-up";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TextField } from "../../../ui/text-field";
import { AuthForm } from "../components/auth-form";
import { useAuthError } from "../components/use-auth-error";

const CODE_LENGTH = 6;

export function VerifyEmailScreen({ email }: { email: string }) {
	const { t } = useI18n();
	const copy = t.auth.verifyEmail;
	const flow = useSignUp();
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
				<Button
					variant="plain"
					label={t.auth.signInCode.resend}
					onPress={async () => {
						setNotice(null);
						if (await flow.resend()) setNotice(t.auth.signInCode.resent);
					}}
				/>
			}
		>
			<TextField
				label={t.auth.signInCode.code}
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
