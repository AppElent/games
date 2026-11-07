import { type CardGameState, getCardGame } from "@arcadeclub/core/cards/engine";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { gameError } from "./errors";
import { findGameState } from "./gameSession";

type Table = Doc<"cardGameStates">;
type ParticipantId = Id<"sessionParticipants">;

const MIN_SECRET_LENGTH = 16;
const MAX_SECRET_LENGTH = 128;

export function requireSeatSecret(secret: string) {
	if (secret.length < MIN_SECRET_LENGTH || secret.length > MAX_SECRET_LENGTH) {
		throw gameError("cardsSeatCredential");
	}
}

/** The engine's state. The column is untyped because its shape belongs to the rule family. */
export function tableGame(table: Pick<Table, "game">) {
	return table.game as CardGameState;
}

export function isTableFull(table: Pick<Table, "gameId" | "seats">) {
	return table.seats.length >= getCardGame(table.gameId).players.max;
}

export function humanSeat(participantId: ParticipantId, secret: string) {
	return { participantId, secret, autopilot: false };
}

export async function appendHumanSeat(
	ctx: MutationCtx,
	table: Pick<Table, "_id" | "seats">,
	participantId: ParticipantId,
	secret: string,
) {
	await ctx.db.patch(table._id, {
		seats: [...table.seats, humanSeat(participantId, secret)],
		updatedAt: Date.now(),
	});
}

/** The seat this participant sits in, whoever is asking; -1 for none. */
export function occupiedSeatIndex(
	table: Pick<Table, "seats">,
	participantId: ParticipantId,
) {
	return table.seats.findIndex((seat) => seat.participantId === participantId);
}

/** The seat this participant sits in, if the secret proves it is theirs. */
export function seatIndexOf(
	table: Pick<Table, "seats">,
	participantId: ParticipantId,
	secret: string,
) {
	const index = occupiedSeatIndex(table, participantId);
	return index >= 0 && table.seats[index].secret === secret ? index : null;
}

/**
 * Seats a joiner in the same mutation that creates them. Their participant id is
 * public from that moment on, so a seat left unclaimed could be taken by anyone
 * who read it. Someone already seated keeps their seat, and a full or running
 * table leaves them watching. Returns whether this secret now holds a seat.
 */
export async function claimSeatOnJoin(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	participantId: ParticipantId,
	seatSecret: string | undefined,
) {
	if (seatSecret === undefined) {
		return false;
	}
	requireSeatSecret(seatSecret);
	const table = await findGameState(ctx, "card-games", session._id);
	if (
		!table ||
		table.status !== "lobby" ||
		isTableFull(table) ||
		occupiedSeatIndex(table, participantId) >= 0
	) {
		return false;
	}
	await appendHumanSeat(ctx, table, participantId, seatSecret);
	// Someone who first came to watch can sit down by joining again.
	await ctx.db.patch(participantId, { role: "player" });
	return true;
}
