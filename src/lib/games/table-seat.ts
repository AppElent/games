import {
	createSeatSecret,
	seatSecretAfterJoin,
} from "@arcadeclub/core/sessions";
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
	return createSeatSecret(() => crypto.randomUUID());
}

/** A returning participant keeps the secret their seat already holds; see `seatSecretAfterJoin`. */
export function rememberTableSeat(
	sessionId: string,
	participantId: Id<"sessionParticipants">,
	seatSecret: string,
	seatClaimed: boolean,
): TableSeat {
	return storeTableSeat(sessionId, {
		participantId,
		seatSecret: seatSecretAfterJoin(
			readTableSeat(sessionId),
			{ participantId, seatClaimed },
			seatSecret,
		),
	});
}

export function storeTableSeat(sessionId: string, seat: TableSeat): TableSeat {
	writeJson(keyOf(sessionId), seat);
	return seat;
}

export function readTableSeat(sessionId: string): TableSeat | null {
	return readJson<TableSeat | null>(keyOf(sessionId), null);
}

export function forgetTableSeat(sessionId: string) {
	removeStored(keyOf(sessionId));
}
