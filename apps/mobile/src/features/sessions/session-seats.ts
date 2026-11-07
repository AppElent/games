/**
 * Which participant this phone is in each online game it has joined or
 * hosted, plus enough metadata to list them under "Continue".
 *
 * The backend identifies a player by participant id after joining (the web
 * keeps it in sessionStorage). Persisting it here is what lets the app
 * reopen an online game after a restart without joining again.
 */
import Storage from "expo-sqlite/kv-store";
import type { Doc } from "../../convex/api";

export type GameType = Doc<"gameSessions">["gameType"];

const KEY = "arcade:seats";
const LIMIT = 20;

export type SessionSeat = {
	sessionId: string;
	participantId: string;
	gameType: GameType;
	joinedAt: number;
	/** Proves a card-game seat is this phone's: participant ids are public. */
	seatSecret?: string;
};

function readAll(): SessionSeat[] {
	try {
		const raw = Storage.getItemSync(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter(
					(item): item is SessionSeat =>
						typeof item?.sessionId === "string" &&
						typeof item?.participantId === "string",
				)
			: [];
	} catch {
		return [];
	}
}

function writeAll(seats: SessionSeat[]) {
	try {
		Storage.setItemSync(KEY, JSON.stringify(seats.slice(0, LIMIT)));
	} catch {
		// Best-effort: the game still works for this launch.
	}
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
