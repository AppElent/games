import {
	applyCardAction,
	botMove,
	type CardAction,
	type CardGameState,
	createCardGame,
	getCardGame,
	normalizeOptions,
	viewCardGame,
	SEAT_SILENT_AFTER_MS,
	nextStarter,
} from "@arcadeclub/core/cards/engine";
import { SUITS } from "@arcadeclub/core/cards/deck";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getOptionalUserId } from "./lib/auth";
import { requireSeatSecret } from "./lib/cardSeats";
import { completeSession, reopenSession } from "./lib/completion";
import { createHostedSession } from "./lib/hostedSession";
import { gameError, toGameError } from "./lib/errors";
import { literals } from "./lib/validators";

/**
 * One backend for every card game: the game id selects a definition from
 * `@arcadeclub/core/cards/engine`, and nothing here names a specific game.
 *
 * Participant ids are public (other games' bundles list them), so they do not
 * prove anything. Seats are claimed with a secret only the client holds; every
 * private read and every move checks it. Guests claim theirs in the join mutation
 * (`lib/cardSeats`), before their id is visible to anyone. Signed-in players may
 * also claim or re-claim a seat later, because their account proves who they are.
 */

type Table = Doc<"cardGameStates">;

const TURN_PACE_MS = { min: 1000, spread: 500 };
const FOLLOW_UP_PACE_MS = 450;
const REACTION_PACE_MS = 2400;

const cardActionValidator = v.union(
	v.object({
		type: v.literal("play"),
		card: v.string(),
		suit: v.optional(literals(SUITS)),
		callLast: v.optional(v.boolean()),
	}),
	v.object({ type: v.literal("draw") }),
	v.object({ type: v.literal("pass") }),
	v.object({ type: v.literal("callLast") }),
	v.object({ type: v.literal("catch"), target: v.number() }),
	v.object({ type: v.literal("drawStock") }),
	v.object({ type: v.literal("takeDiscard") }),
	v.object({
		type: v.literal("layDown"),
		melds: v.optional(v.array(v.array(v.string()))),
		additions: v.optional(
			v.array(v.object({ meldId: v.number(), cards: v.array(v.string()) })),
		),
		swaps: v.optional(
			v.array(v.object({ meldId: v.number(), card: v.string() })),
		),
	}),
	v.object({ type: v.literal("discard"), card: v.string() }),
	v.object({ type: v.literal("nextRound") }),
);

// Arguments are a validator and core is dependency-free, so this cannot be
// derived. It fails typecheck as soon as the two disagree, either way round.
true satisfies [Infer<typeof cardActionValidator>] extends [CardAction]
	? [CardAction] extends [Infer<typeof cardActionValidator>]
		? true
		: false
	: false;

const credential = {
	sessionId: v.id("gameSessions"),
	participantId: v.id("sessionParticipants"),
	seatSecret: v.string(),
};

async function loadTable(
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	return await ctx.db
		.query("cardGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
}

async function requireTable(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	const table = await loadTable(ctx, sessionId);
	if (!session || session.gameType !== "card-games" || !table) {
		throw gameError("gameNotFound");
	}
	return { session, table };
}

function seatIndexOf(
	table: Table,
	participantId: Id<"sessionParticipants">,
	secret: string,
) {
	const index = table.seats.findIndex(
		(seat) => seat.participantId === participantId,
	);
	return index >= 0 && table.seats[index].secret === secret ? index : null;
}

async function requireSeat(
	ctx: MutationCtx,
	args: {
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
		seatSecret: string;
	},
) {
	const { session, table } = await requireTable(ctx, args.sessionId);
	const seat = seatIndexOf(table, args.participantId, args.seatSecret);
	if (seat === null) {
		throw gameError("cardsNotSeated");
	}
	const participant = await ctx.db.get(args.participantId);
	if (!participant || participant.kickedAt) {
		throw gameError("removedByHost");
	}
	return { session, table, seat };
}

async function requireHost(
	ctx: MutationCtx,
	args: {
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
		seatSecret: string;
	},
) {
	const seated = await requireSeat(ctx, args);
	if (seated.session.hostParticipantId !== args.participantId) {
		throw gameError("hostOnly");
	}
	return seated;
}

function nextBotIndex(table: Table) {
	const used = new Set(table.seats.map((seat) => seat.botIndex));
	let index = 0;
	while (used.has(index)) {
		index += 1;
	}
	return index;
}

function botSeats(table: Table) {
	return table.seats.flatMap((seat, index) => (seat.autopilot ? [index] : []));
}

/** Queues the computer's next move; a stale job sees a newer version and stops. */
async function scheduleBots(
	ctx: MutationCtx,
	tableId: Id<"cardGameStates">,
	table: Pick<Table, "gameId" | "options" | "seats" | "version"> & {
		game: CardGameState;
	},
) {
	const move = botMove(
		getCardGame(table.gameId),
		table.options,
		table.game,
		botSeats(table as Table),
	);
	if (!move) {
		return;
	}
	const delay =
		move.pace === "reaction"
			? REACTION_PACE_MS
			: move.pace === "followUp"
				? FOLLOW_UP_PACE_MS
				: TURN_PACE_MS.min + Math.random() * TURN_PACE_MS.spread;
	await ctx.scheduler.runAfter(delay, internal.cardGames.botStep, {
		tableId,
		version: table.version,
	});
}

async function commit(
	ctx: MutationCtx,
	table: Table,
	game: CardGameState,
	extra: Partial<Pick<Table, "seats">> = {},
) {
	const version = table.version + 1;
	const finished = game.phase === "finished";
	const now = Date.now();
	await ctx.db.patch(table._id, {
		...extra,
		game,
		version,
		status: finished ? "finished" : "playing",
		updatedAt: now,
	});
	if (finished) {
		await completeSession(ctx, table.sessionId, {
			endedAt: now,
			winnerParticipantIds: game.winners.flatMap((seat) => {
				const id = table.seats[seat]?.participantId;
				return id ? [id] : [];
			}),
		});
		return;
	}
	await scheduleBots(ctx, table._id, {
		gameId: table.gameId,
		options: table.options,
		seats: extra.seats ?? table.seats,
		version,
		game,
	});
}

async function deal(ctx: MutationCtx, table: Table, starter?: number) {
	try {
		const game = createCardGame(
			getCardGame(table.gameId),
			table.options,
			table.seats.length,
			Math.random,
			starter,
		);
		await commit(ctx, table, game);
	} catch (caught) {
		throw toGameError(caught);
	}
}

/**
 * Opens a table with its session in one step: until the host holds a seat there
 * is no moment in which someone else could claim it.
 */
export const createTable = mutation({
	args: {
		seatSecret: v.string(),
		joinMode: v.union(v.literal("solo"), v.literal("room")),
		title: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
		gameId: v.string(),
		options: v.array(v.string()),
		bots: v.number(),
		start: v.boolean(),
	},
	returns: v.object({
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		joinCode: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		requireSeatSecret(args.seatSecret);
		let game: ReturnType<typeof getCardGame>;
		let options: string[];
		try {
			game = getCardGame(args.gameId);
			options = normalizeOptions(game, args.options);
		} catch (caught) {
			throw toGameError(caught);
		}
		if (
			!Number.isInteger(args.bots) ||
			args.bots < 0 ||
			args.bots + 1 > game.players.max
		) {
			throw gameError("cardsTableFull");
		}
		const created = await createHostedSession(ctx, {
			gameType: "card-games",
			joinMode: args.joinMode,
			authPolicy: "guestAllowed",
			title: args.title,
			displayName: args.displayName,
			guestId: args.guestId,
		});
		const now = Date.now();
		const tableId = await ctx.db.insert("cardGameStates", {
			sessionId: created.sessionId,
			gameId: args.gameId,
			options,
			seats: [
				{
					participantId: created.participantId,
					secret: args.seatSecret,
					autopilot: false,
				},
				...Array.from({ length: args.bots }, (_, botIndex) => ({
					botIndex,
					autopilot: true,
				})),
			],
			status: "lobby",
			version: 0,
			createdAt: now,
			updatedAt: now,
		});
		if (args.start) {
			const table = await ctx.db.get(tableId);
			if (table) {
				await deal(ctx, table);
				await ctx.db.patch(created.sessionId, {
					status: "active",
					startedAt: now,
				});
			}
		}
		return created;
	},
});

/** Confirms the caller's seat, or claims one for a signed-in player. Null: they watch. */
export const takeSeat = mutation({
	args: credential,
	returns: v.union(v.number(), v.null()),
	handler: async (ctx, args) => {
		requireSeatSecret(args.seatSecret);
		const { table } = await requireTable(ctx, args.sessionId);
		const participant = await ctx.db.get(args.participantId);
		if (
			!participant ||
			participant.sessionId !== args.sessionId ||
			participant.kickedAt
		) {
			throw gameError("notInGame");
		}
		if (participant.role === "watcher") {
			return null;
		}
		const index = table.seats.findIndex(
			(seat) => seat.participantId === args.participantId,
		);
		if (index >= 0 && table.seats[index].secret === args.seatSecret) {
			return index;
		}
		const userId = await getOptionalUserId(ctx);
		const ownsParticipant = Boolean(userId) && participant.userId === userId;
		if (index >= 0) {
			if (!ownsParticipant) {
				throw gameError("cardsSeatCredential");
			}
			const seats = [...table.seats];
			seats[index] = { ...seats[index], secret: args.seatSecret };
			await ctx.db.patch(table._id, { seats, updatedAt: Date.now() });
			return index;
		}
		const game = getCardGame(table.gameId);
		if (
			!ownsParticipant ||
			table.status !== "lobby" ||
			table.seats.length >= game.players.max
		) {
			return null;
		}
		await ctx.db.patch(table._id, {
			seats: [
				...table.seats,
				{
					participantId: args.participantId,
					secret: args.seatSecret,
					autopilot: false,
				},
			],
			updatedAt: Date.now(),
		});
		return table.seats.length;
	},
});

export const addBot = mutation({
	args: credential,
	returns: v.null(),
	handler: async (ctx, args) => {
		const { table } = await requireHost(ctx, args);
		if (table.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		if (table.seats.length >= getCardGame(table.gameId).players.max) {
			throw gameError("cardsTableFull");
		}
		await ctx.db.patch(table._id, {
			seats: [
				...table.seats,
				{ botIndex: nextBotIndex(table), autopilot: true },
			],
			updatedAt: Date.now(),
		});
		return null;
	},
});

/** Lobby only: drops a computer player or turns a human away from the table. */
export const removeSeat = mutation({
	args: { ...credential, seat: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { table, seat: hostSeat } = await requireHost(ctx, args);
		if (table.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		const target = table.seats[args.seat];
		if (!target) {
			throw gameError("participantNotFound");
		}
		if (args.seat === hostSeat) {
			throw gameError("hostCannotKickSelf");
		}
		if (target.participantId) {
			await ctx.db.patch(target.participantId, {
				kickedAt: Date.now(),
				connected: false,
			});
		}
		await ctx.db.patch(table._id, {
			seats: table.seats.filter((_, index) => index !== args.seat),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const start = mutation({
	args: credential,
	returns: v.null(),
	handler: async (ctx, args) => {
		const { session, table } = await requireHost(ctx, args);
		if (table.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		await deal(ctx, table);
		await ctx.db.patch(args.sessionId, {
			status: "active",
			startedAt: session.startedAt ?? Date.now(),
			endedAt: undefined,
		});
		return null;
	},
});

export const act = mutation({
	args: { ...credential, action: cardActionValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { table, seat } = await requireSeat(ctx, args);
		if (table.status !== "playing") {
			throw gameError("noActiveGame");
		}
		try {
			const game = applyCardAction(
				getCardGame(table.gameId),
				table.options,
				table.game as CardGameState,
				seat,
				args.action,
			);
			await commit(ctx, table, game);
		} catch (caught) {
			throw toGameError(caught);
		}
		return null;
	},
});

export const botStep = internalMutation({
	args: { tableId: v.id("cardGameStates"), version: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const table = await ctx.db.get(args.tableId);
		if (!table || table.version !== args.version || !table.game) {
			return null;
		}
		const game = getCardGame(table.gameId);
		const state = table.game as CardGameState;
		const move = botMove(game, table.options, state, botSeats(table));
		if (!move) {
			return null;
		}
		await commit(
			ctx,
			table,
			applyCardAction(game, table.options, state, move.seat, move.action),
		);
		return null;
	},
});

/**
 * Hands a seat to the computer, or takes it back. Your own seat any time; the
 * host may hand over anyone's; anyone seated may hand over a seat gone silent.
 */
export const setAutopilot = mutation({
	args: { ...credential, seat: v.number(), on: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { session, table, seat: mine } = await requireSeat(ctx, args);
		const target = table.seats[args.seat];
		if (!target || target.botIndex !== undefined) {
			throw gameError("participantNotFound");
		}
		if (args.seat !== mine) {
			if (!args.on) {
				throw gameError("hostOnly");
			}
			const isHost = session.hostParticipantId === args.participantId;
			const owner = target.participantId
				? await ctx.db.get(target.participantId)
				: null;
			const silent =
				!owner || Date.now() - owner.lastSeen > SEAT_SILENT_AFTER_MS;
			if (!isHost && !silent) {
				throw gameError("cardsPlayerStillActive");
			}
		}
		const seats = table.seats.map((seat, index) =>
			index === args.seat ? { ...seat, autopilot: args.on } : seat,
		);
		const version = table.version + 1;
		await ctx.db.patch(table._id, { seats, version, updatedAt: Date.now() });
		if (table.status === "playing") {
			await scheduleBots(ctx, table._id, {
				gameId: table.gameId,
				options: table.options,
				seats,
				version,
				game: table.game as CardGameState,
			});
		}
		return null;
	},
});

export const rematch = mutation({
	args: credential,
	returns: v.null(),
	handler: async (ctx, args) => {
		// Anyone seated may deal: the host may have left once the game ended.
		const { table } = await requireSeat(ctx, args);
		if (table.status !== "finished") {
			throw gameError("currentGameNotFinished");
		}
		await reopenSession(ctx, args.sessionId);
		await deal(ctx, table, nextStarter(table.game));
		return null;
	},
});

/**
 * The table as one viewer may see it. Secrets, guest ids and account ids stay
 * out; without valid seat credentials the caller is a spectator.
 */
export const getTable = query({
	args: {
		// A plain string: the id comes from a URL, and a mistyped link should
		// reach the "no such table" screen rather than a validation error.
		sessionId: v.string(),
		participantId: v.optional(v.id("sessionParticipants")),
		seatSecret: v.optional(v.string()),
	},
	returns: v.any(),
	handler: async (ctx, args) => {
		const sessionId = ctx.db.normalizeId("gameSessions", args.sessionId);
		const session = sessionId ? await ctx.db.get(sessionId) : null;
		if (!sessionId || !session || session.gameType !== "card-games") {
			return null;
		}
		const table = await loadTable(ctx, sessionId);
		if (!table) {
			return null;
		}
		const you =
			args.participantId && args.seatSecret
				? seatIndexOf(table, args.participantId, args.seatSecret)
				: null;
		const seats = await Promise.all(
			table.seats.map(async (seat) => {
				const participant = seat.participantId
					? await ctx.db.get(seat.participantId)
					: null;
				return {
					participantId: seat.participantId ?? null,
					botIndex: seat.botIndex ?? null,
					autopilot: seat.autopilot,
					name: participant?.displayName ?? null,
					lastSeen: participant?.lastSeen ?? null,
					isHost:
						Boolean(seat.participantId) &&
						seat.participantId === session.hostParticipantId,
				};
			}),
		);
		const game = getCardGame(table.gameId);
		return {
			session: {
				title: session.title,
				joinCode: session.joinCode ?? null,
				joinMode: session.joinMode,
				locked: session.locked ?? false,
			},
			gameId: table.gameId,
			options: table.options,
			status: table.status,
			seats,
			you,
			isHost: you !== null && table.seats[you].participantId === session.hostParticipantId,
			view: table.game
				? viewCardGame(game, table.options, table.game as CardGameState, you)
				: null,
		};
	},
});
