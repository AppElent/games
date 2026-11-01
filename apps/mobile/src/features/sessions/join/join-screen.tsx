/**
 * Join an online game: by room code typed from the host's screen, a scanned
 * invite QR code, or the token in an invite link (`arcadeclub://join?token=…`).
 * A game the app cannot play yet points to the web instead.
 */
import { gameErrorMessage } from "@arcadeclub/core/errors";
import type { GameType } from "@arcadeclub/core/games";
import {
	formatJoinCode,
	isJoinCodeLike,
	normalizeJoinCode,
} from "@arcadeclub/core/sessions";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform } from "react-native";
import { api } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
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
	const convex = useConvex();
	const { t } = useI18n();
	const copy = t.common.joinPanel;
	const colors = useTokens();
	const identity = usePlayerIdentity();
	const { join, busy, error } = useJoinSession();
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
		// Check the game first: joining claims a seat, and the web would then
		// join again under its own guest identity.
		const gameType = await convex
			.query(
				api.sessions.inviteGameType,
				"token" in invite
					? { shareToken: invite.token }
					: { joinCode: invite.code },
			)
			.catch(() => null);
		if (gameType && !onlineSessionHref(gameType, "")) {
			setUnsupported({ gameType, url: webJoinUrl(invite) });
			return;
		}
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
			{shareToken || Platform.OS === "web" ? null : (
				<Button
					variant="secondary"
					label={copy.scan}
					icon={
						<Icon
							ios="qrcode.viewfinder"
							android="qr_code_scanner"
							color={colors.accent}
						/>
					}
					onPress={() => router.push("/scan")}
					testID="join-scan"
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
			<Notice
				message={error ? gameErrorMessage(t, error, copy.joinError) : null}
			/>
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
