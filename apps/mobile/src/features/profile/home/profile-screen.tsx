/**
 * Profile: who this phone plays as (account or guest, and the display name
 * other players see), then phone-local preferences.
 */

import { ACCOUNT_PORTAL_URL } from "@arcadeclub/core/account-portal";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { LOCALES } from "@arcadeclub/core/messages";
import { useAuth, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { env } from "../../../env";
import { fmt, type Locale, useI18n } from "../../../i18n";
import { openFeedbackForm, sentryEnabled } from "../../../observability/init";
import {
	type AppearancePreference,
	spacing,
	useAppearance,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { buildInfoLine } from "../../../updates/build-info";
import {
	PLAYER_NAME_MAX,
	usePlayerIdentity,
} from "../../players/identity/use-player-identity";
import { AccountNameCard } from "../account/account-name-card";
import { useExportData } from "./use-export-data";

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
	const tokens = useTokens();
	const [name, setName] = useState(identity.savedName);
	const [signingOut, setSigningOut] = useState(false);
	const [portalFailed, setPortalFailed] = useState(false);
	const exporter = useExportData(copy.exportData.action);

	const email = user?.primaryEmailAddress?.emailAddress ?? "";
	const buildInfo = {
		version: Constants.expoConfig?.version ?? "",
		build: Constants.platform?.ios?.buildNumber,
		channel: Updates.channel,
		// An update's own bundle carries the commit it was published from.
		updateCreatedAt:
			Updates.isEnabled && !Updates.isEmbeddedLaunch ? Updates.createdAt : null,
		sha: env.gitCommit,
	};

	async function openAccountPortal() {
		setPortalFailed(false);
		try {
			await WebBrowser.openBrowserAsync(ACCOUNT_PORTAL_URL);
		} catch {
			// Android rejects when no browser can open the link.
			setPortalFailed(true);
		}
	}

	return (
		<Screen inTabs>
			<Section title={copy.account}>
				{isSignedIn ? <AccountNameCard /> : null}
				<Card>
					{isSignedIn ? (
						<>
							<AppText variant="body">
								{fmt(copy.signedInAs, { email })}
							</AppText>
							{user?.passwordEnabled ? (
								<Button
									variant="secondary"
									label={copy.password.action}
									disabled={signingOut}
									onPress={() => router.push("/profile/change-password")}
									testID="profile-change-password"
								/>
							) : user ? (
								<AppText variant="secondary">{copy.password.none}</AppText>
							) : null}
							<Button
								variant="secondary"
								label={copy.accountPortal.action}
								icon={
									<Icon
										ios="arrow.up.right.square"
										android="open_in_new"
										size={18}
										color={tokens.accent}
									/>
								}
								disabled={signingOut}
								onPress={() => void openAccountPortal()}
								testID="profile-account-portal"
							/>
							<Notice
								message={portalFailed ? copy.accountPortal.failed : null}
							/>
							<Button
								variant="secondary"
								label={copy.signOut}
								busy={signingOut}
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
								variant="secondary"
								label={copy.exportData.action}
								busy={exporter.busy}
								disabled={!exporter.ready || signingOut}
								onPress={() => void exporter.exportData()}
								testID="profile-export-data"
							/>
							<Notice
								message={
									exporter.error
										? gameErrorMessage(
												t,
												exporter.error,
												copy.exportData.failed,
											)
										: null
								}
							/>
							<Button
								variant="plain"
								label={copy.deleteAccount.action}
								disabled={signingOut}
								onPress={() => router.push("/profile/delete-account")}
								testID="profile-delete-account"
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
					{t.common.appName} · {buildInfoLine(buildInfo, copy)}
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
