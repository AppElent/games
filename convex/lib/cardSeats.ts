import { getCardGame } from "@arcadeclub/core/cards/engine";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { gameError } from "./errors";

const MIN_SECRET_LENGTH = 16;
const MAX_SECRET_LENGTH = 128;

export function requireSeatSecret(secret: string) {
	if (secret.length < MIN_SECRET_LENGTH || secret.length > MAX_SECRET_LENGTH) {
		throw gameError("cardsSeatCredential");
	}
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
	participantId: Id<"sessionParticipants">,
	seatSecret: string | undefined,
) {
	if (session.gameType !== "card-games" || seatSecret === undefined) {
		return false;
	}
	requireSeatSecret(seatSecret);
	const table = await ctx.db
		.query("cardGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", session._id))
		.unique();
	if (
		!table ||
		table.status !== "lobby" ||
		table.seats.length >= getCardGame(table.gameId).players.max ||
		table.seats.some((seat) => seat.participantId === participantId)
	) {
		return false;
	}
	await ctx.db.patch(table._id, {
		seats: [
			...table.seats,
			{ participantId, secret: seatSecret, autopilot: false },
		],
		updatedAt: Date.now(),
	});
	// Someone who first came to watch can sit down by joining again.
	await ctx.db.patch(participantId, { role: "player" });
	return true;
}
