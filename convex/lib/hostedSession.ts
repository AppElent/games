import type { AuthPolicy, GameType, JoinMode } from "@arcadeclub/core/games";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { getOptionalUserId } from "./auth";
import { makeJoinCode, makeShareToken } from "./codes";
import { gameError } from "./errors";
import { insertParticipant } from "./gameSession";

/** What every game's `create` takes besides its own settings. */
export const hostedSessionArgs = {
	title: v.string(),
	displayName: v.string(),
	guestId: v.optional(v.string()),
};

/** What every game's `create` returns: who you are and how others get in. */
export const createdSessionValidator = v.object({
	sessionId: v.id("gameSessions"),
	participantId: v.id("sessionParticipants"),
	joinCode: v.optional(v.string()),
	shareToken: v.optional(v.string()),
});

/**
 * A card table needs its host's seat secret from the first moment, so it is only
 * ever created in one step, by `cardGames.createTable`.
 */
export function assertCreatableWithoutState(gameType: GameType) {
	if (gameType === "card-games") {
		throw gameError("gameUnavailable");
	}
}

/** Inserts a session and its host, so a game can do so within its own mutation. */
export async function createHostedSession(
	ctx: MutationCtx,
	args: {
		gameType: GameType;
		joinMode: JoinMode;
		authPolicy: AuthPolicy;
		title: string;
		displayName: string;
		guestId?: string;
	},
) {
	const userId = await getOptionalUserId(ctx);
	if (args.authPolicy === "signedInRequired" && !userId) {
		throw gameError("signInToHost");
	}
	// Hosting a multiplayer session always requires an account; only solo
	// sessions (sudoku) can be created as a guest.
	if (args.joinMode !== "solo" && !userId) {
		throw gameError("signInToHost");
	}

	let joinCode: string | undefined;
	if (args.joinMode === "room") {
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const candidate = makeJoinCode();
			const existing = await ctx.db
				.query("gameSessions")
				.withIndex("by_joinCode", (q) => q.eq("joinCode", candidate))
				.unique();
			if (!existing) {
				joinCode = candidate;
				break;
			}
		}
		if (!joinCode) {
			throw gameError("joinCodeFailed");
		}
	}

	const shareToken =
		args.joinMode === "challenge" ? makeShareToken() : undefined;
	const sessionId = await ctx.db.insert("gameSessions", {
		gameType: args.gameType,
		status: "lobby",
		joinMode: args.joinMode,
		authPolicy: args.authPolicy,
		title: args.title,
		hostUserId: userId,
		joinCode,
		shareToken,
	});

	const participantId = await insertParticipant(ctx, {
		sessionId,
		userId,
		guestId: args.guestId,
		displayName: args.displayName,
		role: "host",
		seat: "host",
	});

	await ctx.db.patch(sessionId, { hostParticipantId: participantId });

	return { sessionId, participantId, joinCode, shareToken };
}
