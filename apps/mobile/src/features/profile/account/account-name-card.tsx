/**
 * The signed-in account's first and last name, saved to Clerk like the web
 * Account page. A failed save keeps what the person typed and says why.
 *
 * The display name other players see stays the phone-local one
 * (`usePlayerIdentity`); a first name saved here only becomes its default
 * when no display name is set (see `docs/contracts/auth.md`).
 */
import { useUser } from "@clerk/expo";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { TextField } from "../../../ui/text-field";
import { useResetOnChange } from "../../../ui/use-reset-on-change";
import { clerkErrorKey } from "../../auth/components/clerk-errors";
import { type AccountName, nameUpdate } from "./account-edits";

export function AccountNameCard() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.profile.name;
	const savedName = (): AccountName => ({
		firstName: user?.firstName ?? "",
		lastName: user?.lastName ?? "",
	});
	const [draft, setDraft] = useState(savedName);
	const lastNameField = useRef<TextInputInstance>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	// Another account on this phone starts from its own name.
	useResetOnChange(user?.id, () => {
		setDraft(savedName());
		setError(null);
		setSaved(false);
	});

	if (!user) return null;
	const update = nameUpdate(user, draft);

	const edit = (part: keyof AccountName) => (text: string) => {
		setDraft((current) => ({ ...current, [part]: text }));
		setSaved(false);
	};

	const save = async () => {
		if (!update || busy) return;
		setBusy(true);
		setError(null);
		setSaved(false);
		try {
			await user.update(update);
			setSaved(true);
		} catch (failure) {
			const key = clerkErrorKey(failure);
			setError(key && key !== "generic" ? t.auth.errors[key] : copy.failed);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<TextField
				label={copy.firstName}
				value={draft.firstName}
				onChangeText={edit("firstName")}
				autoComplete="given-name"
				textContentType="givenName"
				autoCorrect={false}
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => lastNameField.current?.focus()}
				testID="profile-first-name"
			/>
			<TextField
				ref={lastNameField}
				label={copy.lastName}
				value={draft.lastName}
				onChangeText={edit("lastName")}
				onSubmitEditing={() => void save()}
				autoComplete="family-name"
				textContentType="familyName"
				autoCorrect={false}
				returnKeyType="done"
				testID="profile-last-name"
			/>
			<Button
				variant="secondary"
				label={copy.save}
				busy={busy}
				disabled={!update}
				onPress={() => void save()}
				testID="profile-save-name"
			/>
			<Notice message={error} />
			<Notice message={saved ? copy.saved : null} tone="info" />
		</Card>
	);
}
