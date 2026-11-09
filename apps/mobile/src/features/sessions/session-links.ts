/**
 * The web links invites point at.
 *
 * Share links target the web app's `/join` page so a friend without the app
 * can still play; the app accepts the same token through its own scheme.
 * The web origin is configuration (`EXPO_PUBLIC_WEB_ORIGIN`); without it,
 * invites fall back to the room code alone.
 */
import { buildInviteUrl, type Invite } from "@arcadeclub/core/sessions";
import { env } from "../../env";

const WEB_ORIGIN = env.webOrigin?.replace(/\/+$/, "");

export function webJoinUrl(invite: Invite): string | null {
	return WEB_ORIGIN ? buildInviteUrl(WEB_ORIGIN, invite) : null;
}
