/**
 * This device's claim on a card-game seat. The secret proves the seat is ours:
 * participant ids are public, so they cannot. It lives in localStorage so a
 * refresh or a reopened tab finds the same seat.
 */
export type CardSeat = { participantId: string; seatSecret: string };

const keyOf = (sessionId: string) => `arcade-club.cards.${sessionId}`;

export function newCardSeatSecret() {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/** A returning participant keeps the secret their seat already holds. */
export function rememberCardSeat(
	sessionId: string,
	participantId: string,
	seatSecret: string,
	seatClaimed: boolean,
): CardSeat {
	const existing = readCardSeat(sessionId);
	const seat = {
		participantId,
		seatSecret:
			existing?.participantId === participantId && !seatClaimed
				? existing.seatSecret
				: seatSecret,
	};
	window.localStorage.setItem(keyOf(sessionId), JSON.stringify(seat));
	return seat;
}

export function readCardSeat(sessionId: string): CardSeat | null {
	const stored = window.localStorage.getItem(keyOf(sessionId));
	return stored ? (JSON.parse(stored) as CardSeat) : null;
}

export function forgetCardSeat(sessionId: string) {
	window.localStorage.removeItem(keyOf(sessionId));
}
