import { seatSecretAfterJoin } from "@arcadeclub/core/sessions";
import { readJson, removeStored, writeJson } from "#/lib/games/local-store";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * This device's claim on a seat at a table game (cards, dice). The secret
 * proves the seat is ours: participant ids are public, so they cannot. It lives
 * in localStorage so a refresh or a reopened tab finds the same seat.
 */
export type TableSeat = {
	participantId: Id<"sessionParticipants">;
	seatSecret: string;
};

// Named before dice joined; kept so seats stored by card players still load.
const keyOf = (sessionId: string) => `arcade-club.cards.${sessionId}`;

export function newTableSeatSecret() {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/** A returning participant keeps the secret their seat already holds; see `seatSecretAfterJoin`. */
export function rememberTableSeat(
	sessionId: string,
	participantId: Id<"sessionParticipants">,
	seatSecret: string,
	seatClaimed: boolean,
): TableSeat {
	const seat = {
		participantId,
		seatSecret: seatSecretAfterJoin(
			readTableSeat(sessionId),
			{ participantId, seatClaimed },
			seatSecret,
		),
	};
	writeJson(keyOf(sessionId), seat);
	return seat;
}

/**
 * Carries a seat over from a game that moved onto the table games, unless this
 * device already holds one there. The guest id proves a guest's seat; an
 * account re-keys its seat with whatever secret arrives.
 */
export function adoptTableSeat(
	sessionId: string,
	participantId: Id<"sessionParticipants">,
	seatSecret: string,
) {
	if (!readTableSeat(sessionId)) {
		writeJson(keyOf(sessionId), { participantId, seatSecret });
	}
}

export function readTableSeat(sessionId: string): TableSeat | null {
	return readJson<TableSeat | null>(keyOf(sessionId), null);
}

export function forgetTableSeat(sessionId: string) {
	removeStored(keyOf(sessionId));
}
