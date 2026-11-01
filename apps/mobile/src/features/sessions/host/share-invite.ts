/**
 * Opens the system share sheet with an invite: the web join link when the
 * web origin is configured, otherwise the room code alone. Returns false
 * when there was nothing to share.
 */
import { Share } from "react-native";
import { fmt, type Messages } from "../../../i18n";
import { webJoinUrl } from "../session-links";

export async function shareInvite(
	t: Messages,
	game: string,
	invite: { token?: string; code?: string },
) {
	const link = invite.token
		? webJoinUrl({ token: invite.token })
		: invite.code
			? webJoinUrl({ code: invite.code })
			: null;
	const message = link
		? fmt(t.common.session.shareInvite, { game, link })
		: invite.code
			? fmt(t.common.session.shareCode, { game, code: invite.code })
			: null;
	if (!message) return false;
	try {
		await Share.share({ message });
	} catch {
		// The sheet was dismissed or unavailable; nothing to recover.
	}
	return true;
}
