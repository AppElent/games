/**
 * Opens the system share sheet with an invite: the web join link when the
 * web origin is configured, otherwise the room code alone. Does nothing
 * when there is neither.
 */
import type { Invite } from "@arcadeclub/core/sessions";
import { Share } from "react-native";
import { fmt, type Messages } from "../../../i18n";
import { bestEffort } from "../../../observability/report";
import { webJoinUrl } from "../session-links";

export async function shareInvite(t: Messages, game: string, invite: Invite) {
	const link = webJoinUrl(invite);
	const message = link
		? fmt(t.common.session.shareInvite, { game, link })
		: "code" in invite
			? fmt(t.common.session.shareCode, { game, code: invite.code })
			: null;
	if (!message) return;
	// The sheet may be dismissed or unavailable; nothing to recover.
	await bestEffort(Share.share({ message }));
}
