/** The 6-digit code that proves the new account's address. */
import { useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { AuthForm } from "../components/auth-form";
import { AUTH_CODE_LENGTH, CodeField } from "../components/code-field";
import { useAuthError } from "../components/use-auth-error";
import { useSignUp } from "./use-sign-up";

export function VerifyEmailScreen({ email }: { email: string }) {
	const { t } = useI18n();
	const copy = t.auth.verifyEmail;
	const flow = useSignUp();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const error = useAuthError(flow.errorKey);
	const ready = code.length === AUTH_CODE_LENGTH;

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
			<CodeField
				value={code}
				onChange={setCode}
				onSubmit={() => ready && !flow.busy && flow.verify(code)}
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
