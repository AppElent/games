/**
 * Which participant this phone is in each online game it has joined or
 * hosted, plus enough metadata to list them under "Continue".
 *
 * The backend identifies a player by participant id after joining (the web
 * keeps it in sessionStorage). Persisting it here is what lets the app
 * reopen an online game after a restart without joining again.
 */
import { GAME_TYPES, type GameType } from "@arcadeclub/core/games";
import type { Id } from "../../convex/api";
import { readJson, STORAGE_KEYS, writeJson } from "../../storage/local-store";
import { hasAppScreen, onlineSessionHref } from "./session-links";

const LIMIT = 20;

/** Finished online games drop out once the Play tab sees their status. */
const RESUMABLE_WINDOW_MS = 7 * 24 * 60 * 60_000;

type SessionSeat = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
	gameType: GameType;
	joinedAt: number;
};

function isSeat(value: unknown): value is SessionSeat {
	const seat = value as Partial<SessionSeat> | null;
	return (
		typeof seat?.sessionId === "string" &&
		typeof seat.participantId === "string" &&
		GAME_TYPES.some((gameType) => gameType === seat.gameType) &&
		typeof seat.joinedAt === "number"
	);
}

function readAll(): SessionSeat[] {
	return (
		readJson(STORAGE_KEYS.seats, (value) =>
			Array.isArray(value) ? value.filter(isSeat) : null,
		) ?? []
	);
}

function writeAll(seats: SessionSeat[]) {
	writeJson(STORAGE_KEYS.seats, seats.slice(0, LIMIT));
}

export function listSeats(): SessionSeat[] {
	return readAll().sort((a, b) => b.joinedAt - a.joinedAt);
}

export function findSeat(sessionId: string): SessionSeat | undefined {
	return readAll().find((seat) => seat.sessionId === sessionId);
}

export function rememberSeat(seat: Omit<SessionSeat, "joinedAt">) {
	const rest = readAll().filter((item) => item.sessionId !== seat.sessionId);
	writeAll([{ ...seat, joinedAt: Date.now() }, ...rest]);
}

export function forgetSeat(sessionId: string) {
	writeAll(readAll().filter((seat) => seat.sessionId !== sessionId));
}

/** Recent seats in games this app opens. Removing one leaves the game running. */
export function resumableItems(now = Date.now()) {
	return listSeats().flatMap((seat) => {
		const { sessionId, participantId, gameType } = seat;
		if (now - seat.joinedAt > RESUMABLE_WINDOW_MS) return [];
		if (!hasAppScreen(gameType)) return [];
		return [
			{
				id: `online:${sessionId}`,
				gameType,
				href: onlineSessionHref(gameType, sessionId),
				updatedAt: seat.joinedAt,
				seat: { sessionId, participantId },
				remove: () => forgetSeat(sessionId),
			},
		];
	});
}
