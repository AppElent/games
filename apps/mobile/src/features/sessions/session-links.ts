/**
 * Where a joined session opens, and the web links invites point at.
 *
 * Share links target the web app's `/join` page so a friend without the app
 * can still play; the app accepts the same token through its own scheme.
 * The web origin is configuration (`EXPO_PUBLIC_WEB_ORIGIN`); without it,
 * invites fall back to the room code alone.
 */
import type { Href } from "expo-router";
import type { GameType } from "./session-seats";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN?.replace(/\/+$/, "");

/** The games this app can open; everything else is web-only. */
export const APP_GAME_TYPES = ["sudoku", "backgammon", "hitster"] as const;
export type AppGameType = (typeof APP_GAME_TYPES)[number];

export function isAppGameType(gameType: string): gameType is AppGameType {
	return (APP_GAME_TYPES as readonly string[]).includes(gameType);
}

/** The in-app screen for an online session, or `null` when web-only. */
export function onlineSessionHref(
	gameType: GameType,
	sessionId: string,
): Href | null {
	switch (gameType) {
		case "backgammon":
			return {
				pathname: "/backgammon/online/[sessionId]",
				params: { sessionId },
			};
		case "hitster":
			return { pathname: "/hitster/[sessionId]", params: { sessionId } };
		default:
			return null;
	}
}

/** Whether invites can carry a web link (the web origin is configured). */
export function hasWebOrigin() {
	return Boolean(WEB_ORIGIN);
}

export function webJoinUrl(
	invite: { token: string } | { code: string },
): string | null {
	if (!WEB_ORIGIN) return null;
	const query =
		"token" in invite
			? `token=${encodeURIComponent(invite.token)}`
			: `code=${encodeURIComponent(invite.code)}`;
	return `${WEB_ORIGIN}/join?${query}`;
}
