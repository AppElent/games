import type { BiddingState, Reveal } from "@arcadeclub/core/dice/bidding";
import { DICE_GAMES } from "@arcadeclub/core/dice/engine";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { isSeatSecret } from "./lib/tableSeats";

/**
 * Hand-run backfills (`convex run migrations:<name> --prod`). Each one is
 * idempotent, works in bounded batches, and names what retires it.
 */

const BATCH = 25;

type ParticipantId = Id<"sessionParticipants">;
type LegacyState = Doc<"bluffDiceStates">;

/** The cups of a legacy hand list, in seat order. */
function cupsOf(
	seats: readonly ParticipantId[],
	hands: LegacyState["hands"],
): number[][] {
	return seats.map((participantId) => [
		...(hands.find((hand) => hand.participantId === participantId)?.values ??
			[]),
	]);
}

/**
 * A legacy Bluff Dice game as liar's dice state. Bluff Dice played with five
 * dice, no wild ones and no spot-on call, which is liar's dice with every
 * house rule off, so the same game carries on under the new engine.
 */
export function legacyBiddingState(state: LegacyState): BiddingState {
	const seats = state.turnOrder;
	const seatOf = (participantId: ParticipantId) => seats.indexOf(participantId);
	const cups = cupsOf(seats, state.hands);
	const reveal: Reveal | null = state.lastReveal
		? {
				call: "liar",
				caller: seatOf(state.lastReveal.challengerParticipantId),
				bid: {
					seat: seatOf(state.lastReveal.claim.byParticipantId),
					quantity: state.lastReveal.claim.quantity,
					face: state.lastReveal.claim.face,
				},
				cups: cupsOf(seats, state.lastReveal.hands),
				count: state.lastReveal.actualCount,
				losers: [seatOf(state.lastReveal.loserParticipantId)],
			}
		: null;
	const winner =
		state.winnerParticipantId === undefined
			? -1
			: seatOf(state.winnerParticipantId);
	return {
		family: "bidding",
		phase: state.phase === "finished" ? "finished" : "playing",
		seats: seats.length,
		starter: 0,
		turn: state.activeIndex,
		round: Math.max(1, state.roundNumber),
		cups,
		bids: state.claimHistory.map((claim) => ({
			seat: seatOf(claim.byParticipantId),
			quantity: claim.quantity,
			face: claim.face,
		})),
		reveal,
		// Bluff Dice kept no record of when a player went out.
		outIn: cups.map((cup) => (cup.length === 0 ? 0 : null)),
		winners: winner >= 0 ? [winner] : [],
		events: [],
		nextSeq: 0,
	};
}

/**
 * The seat's secret: a guest's own guest id, which their browser still holds
 * and the Bluff Dice page hands to the dice table; for an account, a fresh one
 * the account re-keys through `takeSeat`.
 */
function seatSecretFor(participant: Doc<"sessionParticipants"> | null) {
	return participant?.guestId && isSeatSecret(participant.guestId)
		? participant.guestId
		: `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

async function convertBluffDiceTable(ctx: MutationCtx, state: LegacyState) {
	const session = await ctx.db.get(state.sessionId);
	if (session?.gameType !== "bluff-dice") {
		await ctx.db.delete(state._id);
		return;
	}
	let seatIds = state.turnOrder;
	if (state.phase === "lobby") {
		// Not dealt yet: the first players to join take the seats there are.
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.collect();
		seatIds = participants
			.filter((row) => row.role !== "watcher" && !row.kickedAt)
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(0, DICE_GAMES["liars-dice"].players.max)
			.map((row) => row._id);
	}
	const seats = await Promise.all(
		seatIds.map(async (participantId) => {
			const participant = await ctx.db.get(participantId);
			return {
				participantId,
				secret: seatSecretFor(participant),
				// Bluff Dice dealt in kicked players; the computer plays them now.
				autopilot: Boolean(participant?.kickedAt),
			};
		}),
	);
	await ctx.db.insert("cardGameStates", {
		sessionId: session._id,
		gameId: "liars-dice",
		options: [],
		seats,
		status:
			state.phase === "lobby"
				? "lobby"
				: state.phase === "finished"
					? "finished"
					: "playing",
		game: state.phase === "lobby" ? undefined : legacyBiddingState(state),
		version: 0,
		createdAt: state.createdAt,
		updatedAt: Date.now(),
	});
	await ctx.db.patch(session._id, { gameType: "dice-games" });
	await ctx.db.delete(state._id);
}

/**
 * Moves every Bluff Dice session onto the dice tables as liar's dice (APP-158).
 * A game already dealt to seven or eight players plays out, but its rematch
 * is refused: liar's dice seats six. Run it until it returns `done: true`;
 * converted rows are deleted, so a rerun picks up where the last batch
 * stopped. Retire it, with the `bluff-dice` game
 * type, its module, route and `bluffDiceStates` table, once production has run
 * it.
 */
export const bluffDiceToDiceTables = internalMutation({
	args: {},
	returns: v.object({ converted: v.number(), done: v.boolean() }),
	handler: async (ctx) => {
		const batch = await ctx.db.query("bluffDiceStates").take(BATCH);
		for (const state of batch) {
			await convertBluffDiceTable(ctx, state);
		}
		return { converted: batch.length, done: batch.length < BATCH };
	},
});
