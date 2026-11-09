import { seatSecretAfterJoin } from "@arcadeclub/core/sessions";
import { readJson, removeStored, writeJson } from "#/lib/games/local-store";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * This device's claim on a card-game seat. The secret proves the seat is ours:
 * participant ids are public, so they cannot. It lives in localStorage so a
 * refresh or a reopened tab finds the same seat.
 */
export type CardSeat = {
	participantId: Id<"sessionParticipants">;
	seatSecret: string;
};

const keyOf = (sessionId: string) => `arcade-club.cards.${sessionId}`;

export function newCardSeatSecret() {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/** A returning participant keeps the secret their seat already holds; see `seatSecretAfterJoin`. */
export function rememberCardSeat(
	sessionId: string,
	participantId: Id<"sessionParticipants">,
	seatSecret: string,
	seatClaimed: boolean,
): CardSeat {
	const seat = {
		participantId,
		seatSecret: seatSecretAfterJoin(
			readCardSeat(sessionId),
			{ participantId, seatClaimed },
			seatSecret,
		),
	};
	writeJson(keyOf(sessionId), seat);
	return seat;
}

export function readCardSeat(sessionId: string): CardSeat | null {
	return readJson<CardSeat | null>(keyOf(sessionId), null);
}

export function forgetCardSeat(sessionId: string) {
	removeStored(keyOf(sessionId));
}
