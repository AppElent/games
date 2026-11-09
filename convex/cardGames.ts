import { SUITS } from "@arcadeclub/core/cards/deck";
import {
	applyCardAction,
	botMove,
	type CardAction,
	type CardGameState,
	createCardGame,
	getCardGame,
	nextStarter,
	normalizeOptions,
	SEAT_SILENT_AFTER_MS,
	viewCardGame,
} from "@arcadeclub/core/cards/engine";
import { CARD_TABLE_STATUSES } from "@arcadeclub/core/cards/table";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getOptionalUserId } from "./lib/auth";
import {
	appendHumanSeat,
	humanSeat,
	isTableFull,
	occupiedSeatIndex,
	requireSeatSecret,
	seatIndexOf,
	tableGame,
} from "./lib/cardSeats";
import { gameError, rules } from "./lib/errors";
import {
	findGameState,
	finishSession,
	kickParticipant,
	loadGame,
	reopenSession,
	requireHostByParticipantId,
	requireParticipant,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";
import { literals } from "./lib/validators";
import { joinModeValidator } from "./schema";

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
/** A table as written, which is all a just-inserted one needs to be dealt. */
type TableRow = Omit<Table, "_creationTime">;

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

/** Everything but `view`, whose shape belongs to the rule family, is checked on the way out. */
const tableEnvelopeValidator = v.object({
	session: v.object({
		title: v.string(),
		joinCode: v.union(v.string(), v.null()),
		joinMode: joinModeValidator,
		locked: v.boolean(),
	}),
	gameId: v.string(),
	options: v.array(v.string()),
	status: literals(CARD_TABLE_STATUSES),
	seats: v.array(
		v.object({
			participantId: v.union(v.id("sessionParticipants"), v.null()),
			botIndex: v.union(v.number(), v.null()),
			autopilot: v.boolean(),
			name: v.union(v.string(), v.null()),
			lastSeen: v.union(v.number(), v.null()),
			isHost: v.boolean(),
		}),
	),
	you: v.union(v.number(), v.null()),
	isHost: v.boolean(),
	view: v.any(),
});

const credential = {
	sessionId: v.id("gameSessions"),
	participantId: v.id("sessionParticipants"),
	seatSecret: v.string(),
};

async function requireSeat(
	ctx: MutationCtx,
	args: {
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
		seatSecret: string;
	},
) {
	const { session, state: table } = await loadGame(
		ctx,
		"card-games",
		args.sessionId,
	);
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

/** The strongest proof of being host: the id must hold its seat with the secret. */
async function requireHostBySeatSecret(
	ctx: MutationCtx,
	args: {
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
		seatSecret: string;
	},
) {
	const seated = await requireSeat(ctx, args);
	requireHostByParticipantId(seated.session, args.participantId);
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

function botSeats(table: Pick<Table, "seats">) {
	return table.seats.flatMap((seat, index) => (seat.autopilot ? [index] : []));
}

/** Queues the computer's next move; a stale job sees a newer version and stops. */
async function scheduleBots(
	ctx: MutationCtx,
	table: Pick<Table, "_id" | "gameId" | "options" | "seats">,
	game: CardGameState,
	version: number,
) {
	const move = botMove(
		getCardGame(table.gameId),
		table.options,
		game,
		botSeats(table),
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
		tableId: table._id,
		version,
	});
}

async function commit(ctx: MutationCtx, table: TableRow, game: CardGameState) {
	const version = table.version + 1;
	const now = Date.now();
	if (game.phase === "finished") {
		await finishSession(
			ctx,
			table,
			{ game, version, status: "finished", updatedAt: now },
			{
				now,
				winners: game.winners.map((seat) => table.seats[seat]?.participantId),
			},
		);
		return;
	}
	await ctx.db.patch(table._id, {
		game,
		version,
		status: "playing",
		updatedAt: now,
	});
	await scheduleBots(ctx, table, game, version);
}

async function deal(ctx: MutationCtx, table: TableRow, starter?: number) {
	const game = rules(() =>
		createCardGame(
			getCardGame(table.gameId),
			table.options,
			table.seats.length,
			Math.random,
			starter,
		),
	);
	await commit(ctx, table, game);
}

/**
 * Opens a table with its session in one step: until the host holds a seat there
 * is no moment in which someone else could claim it.
 */
export const createTable = mutation({
	args: {
		...hostedSessionArgs,
		seatSecret: v.string(),
		joinMode: v.union(v.literal("solo"), v.literal("room")),
		gameId: v.string(),
		options: v.array(v.string()),
		bots: v.number(),
		start: v.boolean(),
	},
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		requireSeatSecret(args.seatSecret);
		const game = rules(() => getCardGame(args.gameId));
		const options = rules(() => normalizeOptions(game, args.options));
		if (
			!Number.isInteger(args.bots) ||
			args.bots < 0 ||
			args.bots + 1 > game.players.max
		) {
			throw gameError("cardsTableFull");
		}
		const hosted = await hostGame(ctx, "card-games", args, args.joinMode);
		const { session, participantId } = hosted;
		const now = Date.now();
		const row = {
			sessionId: session._id,
			gameId: args.gameId,
			options,
			seats: [
				humanSeat(participantId, args.seatSecret),
				...Array.from({ length: args.bots }, (_, botIndex) => ({
					botIndex,
					autopilot: true,
				})),
			],
			status: "lobby" as const,
			version: 0,
			createdAt: now,
			updatedAt: now,
		};
		const tableId = await ctx.db.insert("cardGameStates", row);
		if (args.start) {
			await deal(ctx, { ...row, _id: tableId });
			await startSession(ctx, session, now);
		}
		return createdSession(hosted);
	},
});

/** Confirms the caller's seat, or claims one for a signed-in player. Null: they watch. */
export const takeSeat = mutation({
	args: credential,
	returns: v.union(v.number(), v.null()),
	handler: async (ctx, args) => {
		requireSeatSecret(args.seatSecret);
		const { state: table } = await loadGame(ctx, "card-games", args.sessionId);
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.role === "watcher") {
			return null;
		}
		const held = seatIndexOf(table, args.participantId, args.seatSecret);
		if (held !== null) {
			return held;
		}
		const index = occupiedSeatIndex(table, args.participantId);
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
		if (!ownsParticipant || table.status !== "lobby" || isTableFull(table)) {
			return null;
		}
		await appendHumanSeat(ctx, table, args.participantId, args.seatSecret);
		return table.seats.length;
	},
});

export const addBot = mutation({
	args: credential,
	returns: v.null(),
	handler: async (ctx, args) => {
		const { table } = await requireHostBySeatSecret(ctx, args);
		if (table.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		if (isTableFull(table)) {
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
		const { table, seat: hostSeat } = await requireHostBySeatSecret(ctx, args);
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
			await kickParticipant(ctx, target.participantId);
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
		const { session, table } = await requireHostBySeatSecret(ctx, args);
		if (table.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		await deal(ctx, table);
		await startSession(ctx, session, Date.now());
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
		const game = rules(() =>
			applyCardAction(
				getCardGame(table.gameId),
				table.options,
				tableGame(table),
				seat,
				args.action,
			),
		);
		await commit(ctx, table, game);
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
		const state = tableGame(table);
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
			await scheduleBots(ctx, { ...table, seats }, tableGame(table), version);
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
		await deal(ctx, table, nextStarter(tableGame(table)));
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
	returns: v.union(v.null(), tableEnvelopeValidator),
	handler: async (ctx, args) => {
		const sessionId = ctx.db.normalizeId("gameSessions", args.sessionId);
		const session = sessionId ? await ctx.db.get(sessionId) : null;
		if (!sessionId || !session || session.gameType !== "card-games") {
			return null;
		}
		const table = await findGameState(ctx, "card-games", sessionId);
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
			isHost:
				you !== null &&
				table.seats[you].participantId === session.hostParticipantId,
			view: table.game
				? viewCardGame(game, table.options, tableGame(table), you)
				: null,
		};
	},
});
