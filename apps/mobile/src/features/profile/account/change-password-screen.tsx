/**
 * Change the password of an account that has one, pushed from Profile.
 *
 * iOS AutoFill tells the fields apart only in the change-password shape: a
 * read-only username (the primary email), the current password (`password`),
 * then the new one (`newPassword`). Inline beside other fields it reads both
 * as new and can clear them without `onChangeText`, so this screen stands
 * alone and `useCredentialForm` syncs each field from `onEndEditing` too.
 *
 * When Clerk wants a recent sign-in, the verify sheet opens over this screen
 * (`useChangePassword`).
 *
 * A successful change signs the account's other sessions out
 * (`passwordUpdate`); this one stays signed in.
 *
 * An account with no password (social sign-in or emailed codes only) has
 * nothing to change; Profile hides the link and this screen explains.
 */
import { useAuth, useUser } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, type TextInputInstance } from "react-native";
import { signOutToReturn } from "../../../auth/return-target";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { CenteredState } from "../../../ui/centered-state";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { TextField } from "../../../ui/text-field";
import { EmailField } from "../../auth/components/email-field";
import {
	NEW_PASSWORD_RULES,
	useCredentialForm,
} from "../../auth/components/use-credential-form";
import { ReverifySheet } from "../reverify/reverify-sheet";
import { useChangePassword } from "./use-change-password";

export function ChangePasswordScreen() {
	const { user } = useUser();
	const { signOut } = useAuth();
	const { t } = useI18n();
	const copy = t.profile.password;
	const router = useRouter();
	const form = useCredentialForm({ current: "", next: "" });
	const newField = useRef<TextInputInstance>(null);
	const {
		changePassword,
		busy,
		error: errorKey,
		reverify,
	} = useChangePassword();
	const [leaving, setLeaving] = useState(false);
	// Swiping back while Clerk works unmounts this screen; a late success
	// must not then pop the Profile screen underneath.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

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
		if (!(await changePassword(current, next))) return;
		Alert.alert(copy.changed, copy.changedBody);
		if (mounted.current) router.back();
	};

	const ready = form.values.current.length > 0 && form.values.next.length > 0;
	const error = errorKey
		? errorKey === "generic"
			? copy.failed
			: errorKey === "secondFactorUnsupported"
				? t.serverErrors.accountSecondFactorUnsupported
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
				// The sheet can't confirm this account; the app's own sign-in can.
				<Button
					variant="secondary"
					label={copy.signInAgain}
					busy={leaving}
					onPress={async () => {
						if (leaving) return;
						setLeaving(true);
						router.dismissTo("/profile");
						try {
							await signOutToReturn("/profile/change-password", user.id, () =>
								signOut(),
							);
							router.push("/sign-in");
						} catch {
							// Still signed in on Profile, whose Sign out stays at hand.
						}
					}}
					testID="change-password-sign-in-again"
				/>
			) : null}
			<ReverifySheet reverify={reverify} purpose="changePassword" />
		</Screen>
	);
}
