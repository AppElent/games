import type { GameType } from "@arcadeclub/core/games";
import { normalizeJoinCode } from "@arcadeclub/core/sessions";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getOptionalUserId } from "./auth";
import { claimSeatOnJoin } from "./cardSeats";
import {
	BACKGAMMON_DUEL,
	CHESS_DUEL,
	CONNECT_FOUR_DUEL,
	type Duel,
	seatChallenger,
} from "./duel";
import { gameError } from "./errors";
import { insertParticipant, listParticipants, markConnected } from "./gameSession";

type ParticipantId = Id<"sessionParticipants">;

/** The session behind an invite, or null once it has closed. A token wins over a code. */
export async function findOpenSession(
	ctx: QueryCtx | MutationCtx,
	invite: { joinCode?: string; shareToken?: string },
) {
	const { joinCode, shareToken } = invite;
	let session: Doc<"gameSessions"> | null = null;
	if (shareToken) {
		session = await ctx.db
			.query("gameSessions")
			.withIndex("by_shareToken", (q) => q.eq("shareToken", shareToken))
			.unique();
	} else if (joinCode) {
		const normalized = normalizeJoinCode(joinCode);
		session = await ctx.db
			.query("gameSessions")
			.withIndex("by_joinCode", (q) => q.eq("joinCode", normalized))
			.unique();
	}
	if (
		!session ||
		session.status === "completed" ||
		session.status === "cancelled"
	) {
		return null;
	}
	return session;
}

/**
 * Lets a caller into a session past its auth policy, kicks and lock. This
 * identity's existing row is reclaimed (and with it, its seat), not duplicated.
 */
async function admitParticipant(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	args: { displayName: string; guestId?: string; asSpectator?: boolean },
): Promise<ParticipantId> {
	const userId = await getOptionalUserId(ctx);
	if (session.authPolicy === "signedInRequired" && !userId) {
		throw gameError("signInToJoin");
	}
	const participants = await listParticipants(ctx, session._id);
	const existing = participants.find(
		(participant) =>
			(userId && participant.userId === userId) ||
			(!userId && args.guestId && participant.guestId === args.guestId),
	);
	if (existing?.kickedAt) {
		throw gameError("removedByHost");
	}
	if (existing) {
		await markConnected(ctx, existing._id);
		return existing._id;
	}
	if (session.locked) {
		throw gameError("roomLocked");
	}
	return await insertParticipant(ctx, {
		sessionId: session._id,
		userId,
		guestId: args.guestId,
		displayName: args.displayName,
		role: args.asSpectator ? "watcher" : "player",
	});
}

/** How a joiner came in: a room code (with a card seat secret, if any) or a share link. */
type JoinRoute =
	| { via: "joinCode"; seatSecret: string | undefined }
	| { via: "shareToken" };

/**
 * What a game does when someone other than a spectator joins. Routes differ:
 * a duel seats only share-link joiners, and a card table seats only room-code
 * joiners, who alone hold a seat secret. Resolves to whether this joiner now
 * holds a seat secret's seat.
 */
type OnJoin = (
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	participantId: ParticipantId,
	route: JoinRoute,
) => Promise<boolean>;

function seatChallengerByShareToken<Seat extends string>(
	duel: Duel<Seat>,
): OnJoin {
	return async (ctx, session, participantId, route) => {
		if (route.via === "shareToken") {
			await seatChallenger(ctx, duel, session, participantId);
		}
		return false;
	};
}

const ON_JOIN: Partial<Record<GameType, OnJoin>> = {
	backgammon: seatChallengerByShareToken(BACKGAMMON_DUEL),
	chess: seatChallengerByShareToken(CHESS_DUEL),
	"connect-four": seatChallengerByShareToken(CONNECT_FOUR_DUEL),
	"card-games": async (ctx, session, participantId, route) =>
		route.via === "joinCode"
			? await claimSeatOnJoin(ctx, session, participantId, route.seatSecret)
			: false,
};

/**
 * Joins the session behind an invite: admits the caller, then lets the game
 * seat them. A closed or unknown room code is `roomNotFound`, a share link
 * `gameUnavailable`.
 */
export async function joinSession(
	ctx: MutationCtx,
	invite: { joinCode: string } | { shareToken: string },
	args: {
		displayName: string;
		guestId?: string;
		asSpectator?: boolean;
		seatSecret?: string;
	},
) {
	const session = await findOpenSession(ctx, invite);
	const route: JoinRoute =
		"shareToken" in invite
			? { via: "shareToken" }
			: { via: "joinCode", seatSecret: args.seatSecret };
	if (!session) {
		throw gameError(
			route.via === "joinCode" ? "roomNotFound" : "gameUnavailable",
		);
	}
	const participantId = await admitParticipant(ctx, session, args);
	const seatClaimed =
		!args.asSpectator &&
		((await ON_JOIN[session.gameType]?.(ctx, session, participantId, route)) ??
			false);
	return {
		sessionId: session._id,
		participantId,
		gameType: session.gameType,
		seatClaimed,
	};
}
