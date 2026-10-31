/**
 * Join an online game: by room code typed from the host's screen, or by the
 * token in an invite link (`arcadeclub://join?token=…`). A game the app
 * cannot play yet points to the web instead.
 */
import type { GameType } from "@games/core/games";
import {
	formatJoinCode,
	isJoinCodeLike,
	normalizeJoinCode,
} from "@games/core/sessions";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { usePlayerIdentity } from "../../players/use-player-identity";
import { onlineSessionHref, webJoinUrl } from "../session-links";
import { useJoinSession } from "../use-join-session";

type Props = { shareToken?: string; initialCode?: string };

export function JoinScreen({ shareToken, initialCode }: Props) {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.common.joinPanel;
	const identity = usePlayerIdentity();
	const { join, busy, failed } = useJoinSession();
	const [code, setCode] = useState(
		initialCode ? formatJoinCode(initialCode) : "",
	);
	const [name, setName] = useState(identity.displayName);
	const [unsupported, setUnsupported] = useState<{
		gameType: string;
		url: string | null;
	} | null>(null);

	const ready = shareToken ? true : isJoinCodeLike(code);

	async function submit() {
		if (!ready || busy) return;
		setUnsupported(null);
		const invite = shareToken
			? { token: shareToken }
			: { code: normalizeJoinCode(code) };
		const result = await join(invite, name);
		if (!result) {
			haptics.actionFailed();
			return;
		}
		if (name.trim() && name.trim() !== identity.displayName) {
			identity.setDisplayName(name);
		}
		const href = onlineSessionHref(result.gameType, result.sessionId);
		if (!href) {
			setUnsupported({ gameType: result.gameType, url: webJoinUrl(invite) });
			return;
		}
		setCode("");
		router.push(href);
	}

	const gameName = unsupported
		? unsupported.gameType in t.catalog
			? t.catalog[unsupported.gameType as GameType].title
			: unsupported.gameType
		: "";

	return (
		<Screen inTabs>
			{shareToken ? (
				<Card>
					<AppText variant="heading">{copy.inviteTitle}</AppText>
					<AppText variant="secondary">{copy.inviteBody}</AppText>
				</Card>
			) : (
				<AppText variant="secondary">{copy.subtitle}</AppText>
			)}
			{shareToken ? null : (
				<TextField
					label={t.common.session.roomCode}
					value={code}
					onChangeText={(next) => setCode(formatJoinCode(next).slice(0, 9))}
					placeholder={copy.codePlaceholder}
					autoCapitalize="characters"
					autoCorrect={false}
					autoComplete="off"
					returnKeyType="join"
					onSubmitEditing={submit}
					style={{ letterSpacing: 4 }}
					testID="join-code"
				/>
			)}
			<TextField
				label={copy.displayName}
				value={name}
				onChangeText={setName}
				maxLength={32}
				autoComplete="nickname"
				returnKeyType="join"
				onSubmitEditing={submit}
				testID="join-name"
			/>
			<Notice message={failed ? copy.joinError : null} />
			{unsupported ? (
				<Card>
					<AppText variant="secondary" tone="default">
						{fmt(copy.unsupportedGame, { game: gameName })}
					</AppText>
					{unsupported.url ? (
						<Button
							variant="secondary"
							label={copy.openOnWeb}
							onPress={() => {
								if (unsupported.url) Linking.openURL(unsupported.url);
							}}
						/>
					) : null}
				</Card>
			) : null}
			<Button
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={submit}
				testID="join-submit"
			/>
		</Screen>
	);
}
