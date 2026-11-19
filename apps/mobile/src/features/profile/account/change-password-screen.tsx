/**
 * Change the password of an account that has one, pushed from Profile.
 *
 * iOS AutoFill tells the fields apart only in the change-password shape: a
 * read-only username (the primary email), the current password (`password`),
 * then the new one (`newPassword`). Inline beside other fields it reads both
 * as new and can clear them without `onChangeText`, so this screen stands
 * alone and `useCredentialForm` syncs each field from `onEndEditing` too.
 *
 * An account with no password (social sign-in or emailed codes only) has
 * nothing to change; Profile hides the link and this screen explains.
 */
import { useAuth, useUser } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, type TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { CenteredState } from "../../../ui/centered-state";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { TextField } from "../../../ui/text-field";
import type { ErrorKey } from "../../auth/components/clerk-errors";
import { EmailField } from "../../auth/components/email-field";
import {
	NEW_PASSWORD_RULES,
	useCredentialForm,
} from "../../auth/components/use-credential-form";
import { passwordChangeError } from "./account-edits";

export function ChangePasswordScreen() {
	const { user } = useUser();
	const { signOut } = useAuth();
	const { t } = useI18n();
	const copy = t.profile.password;
	const router = useRouter();
	const form = useCredentialForm({ current: "", next: "" });
	const newField = useRef<TextInputInstance>(null);
	const [busy, setBusy] = useState(false);
	const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
	// Swiping back while Clerk works unmounts this screen; a late success
	// must not then pop the Profile screen underneath.
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[],
	);

	const header = (
		<Stack.Screen options={{ title: copy.title, headerLargeTitle: false }} />
	);
	if (!user?.passwordEnabled) {
		return (
			<>
				{header}
				<CenteredState message={user ? copy.none : undefined} loading={!user} />
			</>
		);
	}

	const submit = async ({ current, next }: typeof form.values) => {
		if (!current || !next || busy) return;
		setBusy(true);
		setErrorKey(null);
		try {
			await user.updatePassword({
				currentPassword: current,
				newPassword: next,
			});
		} catch (failure) {
			setErrorKey(passwordChangeError(failure));
			return;
		} finally {
			setBusy(false);
		}
		Alert.alert(copy.changed, copy.changedBody);
		if (mounted.current) router.back();
	};

	const ready = form.values.current.length > 0 && form.values.next.length > 0;
	const error = errorKey
		? errorKey === "generic"
			? copy.failed
			: t.auth.errors[errorKey]
		: null;

	return (
		<Screen inTabs>
			{header}
			<EmailField
				value={user.primaryEmailAddress?.emailAddress ?? ""}
				editable={false}
				testID="change-password-email"
			/>
			<TextField
				label={copy.current}
				{...form.field("current")}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => newField.current?.focus()}
				testID="change-password-current"
			/>
			<TextField
				ref={newField}
				label={copy.new}
				hint={copy.rules}
				{...form.field("next")}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				passwordRules={NEW_PASSWORD_RULES}
				returnKeyType="go"
				onSubmitEditing={form.submitFrom("next", (values) => {
					void submit(values);
				})}
				testID="change-password-new"
			/>
			<Button
				label={copy.submit}
				busy={busy}
				disabled={!ready && !form.editing}
				onPress={() =>
					form.press((values) => {
						void submit(values);
					})
				}
				testID="change-password-submit"
			/>
			<Notice message={error} />
			{errorKey === "signInAgain" ? (
				// Clerk wants a fresh sign-in; the app's own sign-in gives one.
				<Button
					variant="secondary"
					label={copy.signInAgain}
					onPress={async () => {
						router.dismissTo("/profile");
						await signOut();
						router.push("/sign-in");
					}}
					testID="change-password-sign-in-again"
				/>
			) : null}
		</Screen>
	);
}
