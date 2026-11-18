import {
	SEAT_SILENT_AFTER_MS,
	TABLE_STATUSES,
	type TableEngine,
} from "@arcadeclub/core/table-engine";
import { makeFunctionReference } from "convex/server";
import { type Validator, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { joinModeValidator } from "../schema";
import { gameError, rules } from "./errors";
import {
	findAccountParticipant,
	findGameState,
	finishSession,
	isCaller,
	kickParticipant,
	loadGame,
	reopenSession,
	requireHostByParticipantId,
	requireParticipant,
	startSession,
} from "./gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./hostedSession";
import {
	appendHumanSeat,
	humanSeat,
	isTableFull,
	occupiedSeatIndex,
	requireSeatSecret,
	seatIndexOf,
	type TableGameType,
} from "./tableSeats";
import { literals } from "./validators";

/**
 * One backend for every table game, cards and dice alike: each game type's
 * module (`cardGames`, `diceGames`) is this factory over its engine, and
 * nothing here names a specific game. All of them keep their tables in
 * `cardGameStates` ([ADR 0003](../../docs/adr/0003-dice-games-share-the-table-machinery.md)).
 *
 * Participant ids are public (other games' bundles list them), so they do not
 * prove anything. Seats are claimed with a secret only the client holds; every
 * private read and every move checks it. Guests claim theirs in the join mutation
 * (`lib/tableSeats`), before their id is visible to anyone. Signed-in players may
 * also claim or re-claim a seat later, because their account proves who they are.
 */

type Table = Doc<"cardGameStates">;
/** A table as written, which is all a just-inserted one needs to be dealt. */
type TableRow = Omit<Table, "_creationTime">;

const TURN_PACE_MS = { min: 1000, spread: 500 };
const FOLLOW_UP_PACE_MS = 450;
const REACTION_PACE_MS = 2400;

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
	status: literals(TABLE_STATUSES),
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

type Credential = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
	seatSecret: string;
};

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

/**
 * The public functions of one table game type. `module` is the file that
 * exports them, so a scheduled bot step finds its way back.
 */
export function tableGameFunctions<State, Action, View>(config: {
	gameType: TableGameType;
	module: string;
	engine: TableEngine<State, Action, View>;
	actionValidator: Validator<Action, "required", string>;
}) {
	const { gameType, engine } = config;
	const botStepRef = makeFunctionReference<
		"mutation",
		{ tableId: Id<"cardGameStates">; version: number },
		null
	>(`${config.module}:botStep`);

	/** The engine's state. The column is untyped because its shape belongs to the rule family. */
	const stateOf = (table: Pick<Table, "game">) => table.game as State;

	async function requireSeat(ctx: MutationCtx, args: Credential) {
		const { session, state: table } = await loadGame(
			ctx,
			gameType,
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
	async function requireHostBySeatSecret(ctx: MutationCtx, args: Credential) {
		const seated = await requireSeat(ctx, args);
		requireHostByParticipantId(seated.session, args.participantId);
		return seated;
	}

	/** Queues the computer's next move; a stale job sees a newer version and stops. */
	async function scheduleBots(
		ctx: MutationCtx,
		table: Pick<Table, "_id" | "gameId" | "options" | "seats">,
		game: State,
		version: number,
	) {
		const move = engine.bot(
			table.gameId,
			table.options,
			game,
			botSeats(table),
			Math.random,
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
		await ctx.scheduler.runAfter(delay, botStepRef, {
			tableId: table._id,
			version,
		});
	}

	async function commit(ctx: MutationCtx, table: TableRow, game: State) {
		const version = table.version + 1;
		const now = Date.now();
		const outcome = engine.outcome(game);
		if (outcome.finished) {
			await finishSession(
				ctx,
				table,
				{ game, version, status: "finished", updatedAt: now },
				{
					now,
					winners: outcome.winners.map(
						(seat) => table.seats[seat]?.participantId,
					),
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
			engine.create(
				table.gameId,
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
	const createTable = mutation({
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
			const players = rules(() => engine.players(args.gameId));
			const options = rules(() =>
				engine.normalizeOptions(args.gameId, args.options),
			);
			if (
				!Number.isInteger(args.bots) ||
				args.bots < 0 ||
				args.bots + 1 > players.max
			) {
				throw gameError("cardsTableFull");
			}
			const hosted = await hostGame(ctx, gameType, args, args.joinMode);
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
	const takeSeat = mutation({
		args: credential,
		returns: v.union(v.number(), v.null()),
		handler: async (ctx, args) => {
			requireSeatSecret(args.seatSecret);
			const { state: table } = await loadGame(ctx, gameType, args.sessionId);
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
			// Only an account claims a seat here: a guest's proof is the secret.
			const ownsParticipant = await isCaller(ctx, participant, undefined);
			if (index >= 0) {
				if (!ownsParticipant) {
					throw gameError("cardsSeatCredential");
				}
				const seats = [...table.seats];
				seats[index] = { ...seats[index], secret: args.seatSecret };
				await ctx.db.patch(table._id, { seats, updatedAt: Date.now() });
				return index;
			}
			if (
				!ownsParticipant ||
				table.status !== "lobby" ||
				isTableFull(gameType, table)
			) {
				return null;
			}
			await appendHumanSeat(ctx, table, args.participantId, args.seatSecret);
			return table.seats.length;
		},
	});

	/**
	 * A signed-in player's seat, for a client that holds no secret for it (a new
	 * browser or device). Hands back the seat's own secret rather than a new one,
	 * so the player's other devices stay seated. Null for guests, whose secret is
	 * their only proof, and for accounts without a seat here.
	 */
	const reclaimSeat = mutation({
		args: { sessionId: v.id("gameSessions") },
		returns: v.union(
			v.null(),
			v.object({
				participantId: v.id("sessionParticipants"),
				seatSecret: v.string(),
			}),
		),
		handler: async (ctx, args) => {
			const own = await findAccountParticipant(ctx, args.sessionId);
			if (!own) {
				return null;
			}
			const { state: table } = await loadGame(ctx, gameType, args.sessionId);
			const seat = table.seats[occupiedSeatIndex(table, own._id)];
			if (!seat?.secret) {
				return null;
			}
			return { participantId: own._id, seatSecret: seat.secret };
		},
	});

	const addBot = mutation({
		args: credential,
		returns: v.null(),
		handler: async (ctx, args) => {
			const { table } = await requireHostBySeatSecret(ctx, args);
			if (table.status !== "lobby") {
				throw gameError("gameAlreadyStarted");
			}
			if (isTableFull(gameType, table)) {
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
	const removeSeat = mutation({
		args: { ...credential, seat: v.number() },
		returns: v.null(),
		handler: async (ctx, args) => {
			const { table, seat: hostSeat } = await requireHostBySeatSecret(
				ctx,
				args,
			);
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

	const start = mutation({
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

	const act = mutation({
		args: { ...credential, action: config.actionValidator },
		returns: v.null(),
		handler: async (ctx, args) => {
			const { table, seat } = await requireSeat(ctx, args);
			if (table.status !== "playing") {
				throw gameError("noActiveGame");
			}
			const game = rules(() =>
				engine.apply(
					table.gameId,
					table.options,
					stateOf(table),
					seat,
					args.action as Action,
					Math.random,
				),
			);
			await commit(ctx, table, game);
			return null;
		},
	});

	const botStep = internalMutation({
		args: { tableId: v.id("cardGameStates"), version: v.number() },
		returns: v.null(),
		handler: async (ctx, args) => {
			const table = await ctx.db.get(args.tableId);
			if (!table || table.version !== args.version || !table.game) {
				return null;
			}
			const state = stateOf(table);
			const move = engine.bot(
				table.gameId,
				table.options,
				state,
				botSeats(table),
				Math.random,
			);
			if (!move) {
				return null;
			}
			await commit(
				ctx,
				table,
				engine.apply(
					table.gameId,
					table.options,
					state,
					move.seat,
					move.action,
					Math.random,
				),
			);
			return null;
		},
	});

	/**
	 * Hands a seat to the computer, or takes it back. Your own seat any time; the
	 * host may hand over anyone's; anyone seated may hand over a seat gone silent.
	 */
	const setAutopilot = mutation({
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
				await scheduleBots(ctx, { ...table, seats }, stateOf(table), version);
			}
			return null;
		},
	});

	const rematch = mutation({
		args: credential,
		returns: v.null(),
		handler: async (ctx, args) => {
			// Anyone seated may deal: the host may have left once the game ended.
			const { table } = await requireSeat(ctx, args);
			if (table.status !== "finished") {
				throw gameError("currentGameNotFinished");
			}
			await reopenSession(ctx, args.sessionId);
			await deal(ctx, table, engine.nextStarter(stateOf(table)));
			return null;
		},
	});

	/**
	 * The table as one viewer may see it. Secrets, guest ids and account ids stay
	 * out; without valid seat credentials the caller is a spectator.
	 */
	const getTable = query({
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
			if (!sessionId || !session || session.gameType !== gameType) {
				return null;
			}
			const table = await findGameState(ctx, gameType, sessionId);
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
					? engine.view(table.gameId, table.options, stateOf(table), you)
					: null,
			};
		},
	});

	return {
		createTable,
		takeSeat,
		reclaimSeat,
		addBot,
		removeSeat,
		start,
		act,
		botStep,
		setAutopilot,
		rematch,
		getTable,
	};
}
