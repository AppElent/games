import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type {
	authPolicyValidator,
	gameTypeValidator,
	joinModeValidator,
} from "../schema";
import { getOptionalUserId } from "./auth";
import { makeJoinCode, makeShareToken } from "./codes";
import { gameError } from "./errors";

/** Inserts a session and its host, so a game can do so within its own mutation. */
export async function createHostedSession(
	ctx: MutationCtx,
	args: {
		gameType: Infer<typeof gameTypeValidator>;
		joinMode: Infer<typeof joinModeValidator>;
		authPolicy: Infer<typeof authPolicyValidator>;
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

	const sessionId = await ctx.db.insert("gameSessions", {
		gameType: args.gameType,
		status: "lobby",
		joinMode: args.joinMode,
		authPolicy: args.authPolicy,
		title: args.title,
		hostUserId: userId,
		joinCode,
		shareToken: args.joinMode === "challenge" ? makeShareToken() : undefined,
	});

	const participantId = await ctx.db.insert("sessionParticipants", {
		sessionId,
		userId,
		guestId: userId ? undefined : args.guestId,
		displayName: args.displayName,
		role: "host",
		seat: "host",
		connected: true,
		lastSeen: Date.now(),
	});

	await ctx.db.patch(sessionId, { hostParticipantId: participantId });

	return { sessionId, participantId, joinCode };
}
