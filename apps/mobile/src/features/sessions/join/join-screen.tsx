/**
 * Join an online game: by room code typed from the host's screen, a scanned
 * invite QR code, or the token in an invite link (`arcadeclub://join?token=…`).
 * A game the app cannot play yet points to the web instead.
 */
import { gameErrorMessage } from "@arcadeclub/core/errors";
import type { GameType } from "@arcadeclub/core/games";
import {
	FORMATTED_JOIN_CODE_MAX_LENGTH,
	formatJoinCode,
	isJoinCodeLike,
	normalizeJoinCode,
} from "@arcadeclub/core/sessions";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { api } from "../../../convex/api";
import { fmt, useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { isOnlineAppGame, onlineSessionHref } from "../../play/app-games";
import {
	PLAYER_NAME_MAX,
	usePlayerIdentity,
} from "../../players/identity/use-player-identity";
import { openWebPage, webJoinUrl } from "../session-links";
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
		gameType: GameType;
		url: string | null;
	} | null>(null);

	const ready = shareToken ? true : isJoinCodeLike(code);

	async function submit() {
		if (!ready || busy) return;
		setUnsupported(null);
		const invite = shareToken
			? { token: shareToken }
			: { code: normalizeJoinCode(code) };
		const showUnsupported = (gameType: GameType) =>
			setUnsupported({ gameType, url: webJoinUrl(invite) });
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
		if (gameType && !isOnlineAppGame(gameType)) {
			showUnsupported(gameType);
			return;
		}
		const result = await join(invite, name);
		if (!result) return;
		if (!isOnlineAppGame(result.gameType)) {
			showUnsupported(result.gameType);
			return;
		}
		setCode("");
		router.push(onlineSessionHref(result.gameType, result.sessionId));
	}

	const gameName = unsupported ? t.catalog[unsupported.gameType].title : "";

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
					onChangeText={(next) =>
						setCode(
							formatJoinCode(next).slice(0, FORMATTED_JOIN_CODE_MAX_LENGTH),
						)
					}
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
			{shareToken ? null : (
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
				maxLength={PLAYER_NAME_MAX}
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
								if (unsupported.url) void openWebPage(unsupported.url);
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
