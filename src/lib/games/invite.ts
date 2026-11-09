import { buildInviteUrl } from "@arcadeclub/core/sessions";

/** What a player shares: the session's link or code, else the page itself. */
export function sessionInviteUrl(session: {
	shareToken?: string;
	joinCode?: string;
}) {
	if (typeof window === "undefined") {
		return "";
	}
	if (session.shareToken) {
		return buildInviteUrl(window.location.origin, {
			token: session.shareToken,
		});
	}
	if (session.joinCode) {
		return buildInviteUrl(window.location.origin, { code: session.joinCode });
	}
	return window.location.href;
}
