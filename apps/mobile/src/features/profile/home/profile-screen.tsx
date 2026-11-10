/**
 * Profile: who this phone plays as (account or guest, and the display name
 * other players see), then phone-local preferences.
 */

import { gameErrorMessage } from "@arcadeclub/core/errors";
import { LOCALES } from "@arcadeclub/core/messages";
import { useAuth, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { env } from "../../../env";
import { fmt, type Locale, useI18n } from "../../../i18n";
import { openFeedbackForm, sentryEnabled } from "../../../observability/init";
import {
	type AppearancePreference,
	spacing,
	useAppearance,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import {
	PLAYER_NAME_MAX,
	usePlayerIdentity,
} from "../../players/identity/use-player-identity";
import { useDeleteAccount } from "./use-delete-account";

/** The web app's policy page; EAS sets the origin for every build it ships. */
const PRIVACY_URL = env.webOrigin
	? `${env.webOrigin.replace(/\/+$/, "")}/privacy`
	: null;

const APPEARANCES: readonly AppearancePreference[] = [
	"system",
	"light",
	"dark",
];

export function ProfileScreen() {
	const router = useRouter();
	const { t, locale, setLocale } = useI18n();
	const copy = t.profile;
	const { isSignedIn, signOut } = useAuth();
	const { user } = useUser();
	const identity = usePlayerIdentity();
	const appearance = useAppearance();
	const [name, setName] = useState(identity.savedName);
	const [signingOut, setSigningOut] = useState(false);
	const deletion = useDeleteAccount();

	const email = user?.primaryEmailAddress?.emailAddress ?? "";
	const version = Constants.expoConfig?.version ?? "";

	return (
		<Screen inTabs>
			<Section title={copy.account}>
				<Card>
					{isSignedIn ? (
						<>
							<AppText variant="body">
								{fmt(copy.signedInAs, { email })}
							</AppText>
							<Button
								variant="secondary"
								label={copy.signOut}
								busy={signingOut}
								disabled={deletion.busy}
								onPress={async () => {
									setSigningOut(true);
									try {
										await signOut();
									} finally {
										setSigningOut(false);
									}
								}}
								testID="profile-sign-out"
							/>
							<Button
								variant="plain"
								label={copy.deleteAccount.action}
								busy={deletion.busy}
								disabled={!deletion.ready || signingOut}
								onPress={() =>
									Alert.alert(
										copy.deleteAccount.confirmTitle,
										copy.deleteAccount.confirmBody,
										[
											{ text: t.common.actions.cancel, style: "cancel" },
											{
												text: copy.deleteAccount.confirm,
												style: "destructive",
												onPress: () => void deletion.deleteAccount(),
											},
										],
									)
								}
								testID="profile-delete-account"
							/>
							<Notice
								message={
									deletion.error
										? gameErrorMessage(
												t,
												deletion.error,
												copy.deleteAccount.failed,
											)
										: deletion.unavailable
											? copy.deleteAccount.unavailable
											: null
								}
							/>
						</>
					) : (
						<>
							<AppText variant="heading">{copy.guestTitle}</AppText>
							<AppText variant="secondary">{copy.guestBody}</AppText>
							<Button
								label={t.common.actions.signIn}
								onPress={() => router.push("/sign-in")}
								testID="profile-sign-in"
							/>
						</>
					)}
				</Card>
				<TextField
					label={copy.displayName}
					hint={copy.displayNameHint}
					value={name}
					placeholder={identity.defaultName}
					onChangeText={setName}
					onEndEditing={() => identity.setDisplayName(name)}
					maxLength={PLAYER_NAME_MAX}
					autoComplete="nickname"
					returnKeyType="done"
					testID="profile-display-name"
				/>
			</Section>
			<Section title={copy.preferences}>
				<AppText variant="label">{copy.appearance}</AppText>
				<Segmented
					accessibilityLabel={copy.appearance}
					options={APPEARANCES.map((value) => ({
						value,
						label: copy.appearanceOptions[value],
					}))}
					value={appearance.preference}
					onChange={appearance.setPreference}
				/>
				<AppText variant="label">{copy.language}</AppText>
				<Segmented<Locale>
					accessibilityLabel={copy.language}
					options={LOCALES.map((value) => ({
						value,
						label: copy.languages[value],
					}))}
					value={locale}
					onChange={setLocale}
				/>
			</Section>
			<Section title={copy.about}>
				{PRIVACY_URL ? (
					<Button
						variant="secondary"
						label={t.privacy.title}
						onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
						testID="profile-privacy-policy"
					/>
				) : null}
				{sentryEnabled ? (
					<Button
						variant="secondary"
						label={t.common.feedback.report}
						onPress={openFeedbackForm}
						testID="profile-report-problem"
					/>
				) : null}
				<AppText variant="caption" selectable>
					{t.common.appName} · {fmt(copy.version, { version })}
					{Updates.isEnabled && Updates.channel
						? `\n${fmt(
								Updates.isEmbeddedLaunch || !Updates.updateId
									? copy.runningBuild
									: copy.runningUpdate,
								{
									channel: Updates.channel,
									id: Updates.updateId?.slice(0, 8) ?? "",
								},
							)}`
						: null}
				</AppText>
			</Section>
		</Screen>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header">
				{title.toUpperCase()}
			</AppText>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.md },
});
