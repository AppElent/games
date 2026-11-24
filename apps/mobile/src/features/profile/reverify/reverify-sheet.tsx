/**
 * The sheet that confirms it's the account's owner, with the password or an
 * emailed code. `useReverify` owns the attempt; the sheet keeps only what is
 * typed, and drops it when the sheet closes or changes method.
 */
import { useUser } from "@clerk/expo";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { Notice } from "../../../ui/notice";
import { Sheet } from "../../../ui/sheet";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import {
	AUTH_CODE_LENGTH,
	CodeField,
	codeDigits,
} from "../../auth/components/code-field";
import { EmailField } from "../../auth/components/email-field";
import { useAuthError } from "../../auth/components/use-auth-error";
import { useCredentialForm } from "../../auth/components/use-credential-form";
import type { useReverify } from "./use-reverify";

type Reverify = ReturnType<typeof useReverify>;

export function ReverifySheet({ reverify }: { reverify: Reverify }) {
	const { t } = useI18n();
	return (
		<Sheet
			open={reverify.method !== null}
			title={t.profile.reverify.title}
			onClose={reverify.cancel}
			closeLabel={t.common.actions.cancel}
			closeTestID="reverify-cancel"
		>
			{reverify.method === "password" ? (
				<PasswordStep reverify={reverify} />
			) : reverify.method === "code" ? (
				<CodeStep reverify={reverify} />
			) : null}
		</Sheet>
	);
}

function PasswordStep({ reverify }: { reverify: Reverify }) {
	const { t } = useI18n();
	const { user } = useUser();
	const copy = t.profile.reverify;
	const form = useCredentialForm({ password: "" });
	const submit = ({ password }: typeof form.values) => {
		if (password) void reverify.submit(password);
	};
	return (
		<>
			<AppText variant="secondary">{copy.passwordBody}</AppText>
			<EmailField
				value={user?.primaryEmailAddress?.emailAddress ?? ""}
				editable={false}
				testID="reverify-email"
			/>
			<TextField
				label={t.auth.signIn.password}
				{...form.field("password")}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				autoFocus
				returnKeyType="go"
				onSubmitEditing={form.submitFrom("password", submit)}
				testID="reverify-password"
			/>
			<ReverifyNotices reverify={reverify} />
			<Button
				label={copy.submit}
				busy={reverify.busy}
				disabled={!form.values.password && !form.editing}
				onPress={() => form.press(submit)}
				testID="reverify-submit"
			/>
			{reverify.email ? (
				<Button
					variant="plain"
					label={copy.emailCode}
					disabled={reverify.busy}
					onPress={() => void reverify.sendCode()}
					testID="reverify-email-code"
				/>
			) : null}
		</>
	);
}

function CodeStep({ reverify }: { reverify: Reverify }) {
	const { t } = useI18n();
	const copy = t.profile.reverify;
	const form = useCredentialForm({ code: "" });
	const submit = ({ code }: typeof form.values) => {
		if (code.length === AUTH_CODE_LENGTH) void reverify.submit(code);
	};
	return (
		<>
			<AppText variant="secondary">
				{fmt(copy.codeBody, { email: reverify.email ?? "" })}
			</AppText>
			<CodeField
				{...form.field("code", codeDigits)}
				onSubmitEditing={() => submit(form.values)}
				testID="reverify-code"
			/>
			<ReverifyNotices reverify={reverify} />
			<Button
				label={copy.submit}
				busy={reverify.busy}
				disabled={form.values.code.length !== AUTH_CODE_LENGTH && !form.editing}
				onPress={() => form.press(submit)}
				testID="reverify-submit"
			/>
			<Button
				variant="plain"
				label={t.auth.signInCode.resend}
				busy={reverify.sending}
				disabled={reverify.busy}
				onPress={() => void reverify.sendCode()}
				testID="reverify-resend"
			/>
			{reverify.hasPassword ? (
				<Button
					variant="plain"
					label={copy.usePassword}
					disabled={reverify.busy || reverify.sending}
					onPress={reverify.usePassword}
					testID="reverify-use-password"
				/>
			) : null}
		</>
	);
}

function ReverifyNotices({ reverify }: { reverify: Reverify }) {
	const { t } = useI18n();
	const error = useAuthError(reverify.error);
	return (
		<>
			<Notice message={error} />
			<Notice
				message={reverify.codeSent ? t.auth.signInCode.resent : null}
				tone="info"
			/>
		</>
	);
}
