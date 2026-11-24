/**
 * Delete account, pushed from Profile. The login is the shared AppElent
 * account, so the person first picks what goes: Arcade Club's data only
 * (listed first; the login keeps working in the other apps) or the whole
 * AppElent account, which names the other apps it reaches. A native alert
 * confirms the choice, then `useDeleteAccount` runs it. An old sign-in opens
 * the verify sheet over this screen before anything is deleted; an account the
 * sheet can't handle is offered "Sign in again" here.
 */
import type { DeletionScope } from "@arcadeclub/core/account-deletion";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { ChoiceList } from "../../../ui/choice-list";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { ReverifySheet } from "../reverify/reverify-sheet";
import { useDeleteAccount } from "./use-delete-account";

const SCOPES: readonly DeletionScope[] = ["app", "account"];

export function DeleteAccountScreen() {
	const { t } = useI18n();
	const copy = t.profile.deleteAccount;
	const router = useRouter();
	const deletion = useDeleteAccount();
	const [scope, setScope] = useState<DeletionScope>("app");
	const [leaving, setLeaving] = useState(false);

	const run = async (chosen: DeletionScope) => {
		if (!(await deletion.deleteAccount(chosen))) return;
		router.dismissTo("/profile");
		if (chosen === "app") Alert.alert(copy.app.doneTitle, copy.app.doneBody);
	};

	const confirm = () => {
		const chosen = scope;
		Alert.alert(copy[chosen].confirmTitle, copy[chosen].confirmBody, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{
				text: copy[chosen].confirm,
				style: "destructive",
				onPress: () => void run(chosen),
			},
		]);
	};

	return (
		<Screen inTabs>
			<Stack.Screen options={{ title: copy.action, headerLargeTitle: false }} />
			<AppText variant="heading" accessibilityRole="header">
				{copy.chooseTitle}
			</AppText>
			<AppText variant="secondary">{copy.chooseBody}</AppText>
			<ChoiceList
				choices={SCOPES.map((value) => ({
					value,
					label: copy[value].label,
					detail: copy[value].detail,
				}))}
				value={scope}
				onChange={setScope}
				accessibilityLabel={copy.chooseTitle}
				testID="delete-account-scope"
			/>
			<Button
				label={copy.continue}
				busy={deletion.busy}
				disabled={!deletion.ready || leaving}
				onPress={confirm}
				testID="delete-account-continue"
			/>
			<Notice
				message={
					deletion.error
						? gameErrorMessage(t, deletion.error, copy.failed)
						: deletion.unavailable
							? copy.unavailable
							: null
				}
			/>
			{deletion.needsSignIn ? (
				// The sheet can't confirm this account; the app's own sign-in can.
				<Button
					variant="secondary"
					label={copy.signInAgain}
					busy={leaving}
					onPress={async () => {
						if (leaving) return;
						if (deletion.signedOut) {
							// Opens over this screen and closes back to it.
							router.push("/sign-in");
							return;
						}
						setLeaving(true);
						router.dismissTo("/profile");
						try {
							await deletion.signInAgain();
							router.push("/sign-in");
						} catch {
							// Still signed in on Profile, whose Sign out stays at hand.
						}
					}}
					testID="delete-account-sign-in-again"
				/>
			) : null}
			<ReverifySheet reverify={deletion.reverify} />
		</Screen>
	);
}
