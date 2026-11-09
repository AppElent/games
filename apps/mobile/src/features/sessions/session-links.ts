/**
 * Where a joined session opens, and the web links invites point at.
 *
 * Share links target the web app's `/join` page so a friend without the app
 * can still play; the app accepts the same token through its own scheme.
 * The web origin is configuration (`EXPO_PUBLIC_WEB_ORIGIN`); without it,
 * invites fall back to the room code alone.
 */
import type { GameType } from "@arcadeclub/core/games";
import { buildInviteUrl, type Invite } from "@arcadeclub/core/sessions";
import type { Href } from "expo-router";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN?.replace(/\/+$/, "");

/** The online games this app opens; every other game is web-only. */
const SESSION_HREFS = {
	backgammon: (sessionId: string) => ({
		pathname: "/backgammon/online/[sessionId]",
		params: { sessionId },
	}),
	hitster: (sessionId: string) => ({
		pathname: "/hitster/[sessionId]",
		params: { sessionId },
	}),
} satisfies Partial<Record<GameType, (sessionId: string) => Href>>;

type AppSessionGameType = keyof typeof SESSION_HREFS;

export function hasAppScreen(
	gameType: GameType,
): gameType is AppSessionGameType {
	return gameType in SESSION_HREFS;
}

/** The in-app screen for an online session. */
export function onlineSessionHref(
	gameType: AppSessionGameType,
	sessionId: string,
): Href {
	return SESSION_HREFS[gameType](sessionId);
}

/** Whether invites can carry a web link (the web origin is configured). */
export function hasWebOrigin() {
	return Boolean(WEB_ORIGIN);
}

export function webJoinUrl(invite: Invite): string | null {
	return WEB_ORIGIN ? buildInviteUrl(WEB_ORIGIN, invite) : null;
}
