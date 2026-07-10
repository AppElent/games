import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type CompletedReason = "finished" | "cancelled" | "abandoned";

/**
 * Marks a session terminal and records the analytics metadata every game
 * shares: end time, reason, participant count, and winners.
 */
/** Reverts a completed session back to active play (in-place rematch). */
export async function reopenSession(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	await ctx.db.patch(sessionId, {
		status: "active",
		endedAt: undefined,
		completedReason: undefined,
		winnerParticipantIds: undefined,
	});
}

export async function completeSession(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	options: {
		reason?: CompletedReason;
		winnerParticipantIds?: Id<"sessionParticipants">[];
		endedAt?: number;
	} = {},
) {
	const participants = await ctx.db
		.query("sessionParticipants")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.collect();
	const reason = options.reason ?? "finished";
	await ctx.db.patch(sessionId, {
		status: reason === "cancelled" ? "cancelled" : "completed",
		endedAt: options.endedAt ?? Date.now(),
		completedReason: reason,
		participantCount: participants.filter((p) => !p.kickedAt).length,
		winnerParticipantIds: options.winnerParticipantIds ?? [],
	});
}
