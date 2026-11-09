/**
 * Backgammon's front door: continue or start pass-and-play on this phone,
 * or create an online challenge to send to a friend.
 */

import { gameErrorMessage } from "@arcadeclub/core/errors";
import { useMutation } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";
import { onlineSessionHref } from "../../sessions/session-links";
import { confirmNewMatch } from "../components/confirm-new-match";
import {
	hubOffersContinue,
	LOCAL_MATCH_HREF,
	readLocalMatch,
	startNewLocalMatch,
} from "../local/local-match-store";

/** Whether a pass-and-play match is under way and worth continuing. */
function hasMatchInProgress() {
	const match = readLocalMatch();
	return Boolean(match && hubOffersContinue(match));
}

export function BackgammonHomeScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.games.backgammon;
	const hosting = useHostSession();
	const create = useMutation(api.backgammon.create);
	const [inProgress, setInProgress] = useState(false);

	useFocusEffect(
		useCallback(() => {
			setInProgress(hasMatchInProgress());
		}, []),
	);

	const startLocal = () => {
		const start = () => {
			startNewLocalMatch();
			router.push(LOCAL_MATCH_HREF);
		};
		if (inProgress) confirmNewMatch(t, start);
		else start();
	};

	const createChallenge = async () => {
		const session = await hosting.host("backgammon", (host) =>
			create({ ...host, title: t.catalog.backgammon.title }),
		);
		if (session)
			router.push(onlineSessionHref("backgammon", session.sessionId));
	};

	return (
		<Screen>
			<Card>
				<View style={styles.section}>
					<AppText variant="heading" accessibilityRole="header">
						{copy.newGame.localMatchHeading}
					</AppText>
					<AppText variant="secondary">
						{copy.newGame.localMatchDescription}
					</AppText>
					{inProgress ? (
						<Button
							label={copy.newGame.continueLocal}
							onPress={() => router.push(LOCAL_MATCH_HREF)}
							testID="bg-continue-local"
						/>
					) : null}
					<Button
						variant={inProgress ? "secondary" : "primary"}
						label={t.common.endScreen.newGame}
						onPress={startLocal}
						testID="bg-new-local"
					/>
				</View>
			</Card>
			<Card>
				<View style={styles.section}>
					<AppText variant="heading" accessibilityRole="header">
						{copy.newGame.onlineChallengeHeading}
					</AppText>
					<AppText variant="secondary">
						{copy.newGame.onlineChallengeDescription}
					</AppText>
					{hosting.isSignedIn ? (
						<Button
							label={copy.newGame.createChallengeLink}
							onPress={createChallenge}
							busy={hosting.busy}
							disabled={!hosting.canHost}
							testID="bg-create-challenge"
						/>
					) : (
						<HostGate />
					)}
					<Notice
						message={
							hosting.error
								? gameErrorMessage(
										t,
										hosting.error,
										copy.newGame.createChallengeError,
									)
								: null
						}
					/>
				</View>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.md },
});
