/**
 * Beat the Clock rooms. Rules live in `@arcadeclub/core/beat-the-clock`; this
 * module loads the room, proves the caller's seat, applies one rule and
 * stores the result. The server owns the clock: whenever a phase gets a
 * deadline, a scheduled `timeout` moves it on, so the game never waits on a
 * phone that went quiet.
 */
import {
	type ClockState,
	canSeeWords,
	clockRole,
	confirm,
	createClockState,
	endGame,
	flag,
	go,
	leave as leaveRule,
	nextTurn,
	packRunsLow,
	pause as pauseRule,
	pickTeam as pickTeamRule,
	rematch,
	resume as resumeRule,
	seeWinner as seeWinnerRule,
	send as sendRule,
	settleRoom,
	shuffleTeams as shuffleRule,
	skipTurn,
	startExtraRound,
	startGame,
	syncRoster,
	teamMembers,
	tick as tickRule,
	timeout as timeoutRule,
} from "@arcadeclub/core/beat-the-clock";
import {
	clockPackWords,
	clockWords,
	isClockPackId,
} from "@arcadeclub/core/beat-the-clock-packs";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	internalMutation,
	type MutationCtx,
	mutation,
	query,
} from "./_generated/server";
import { gameError, rules } from "./lib/errors";
import {
	findOwnParticipant,
	finishSession,
	listParticipants,
	loadBundle,
	loadGame,
	reopenSession,
	requireHost,
	requireOwnParticipant,
	type SeatArgs,
	seatArgs,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";

const GAME = "beat-the-clock";

type StateDoc = Doc<"beatTheClockStates">;

/** The stored row as core's state: the same fields, without the row's own. */
function toRules(doc: StateDoc): ClockState {
	const {
		_id: _rowId,
		_creationTime: _created,
		sessionId: _session,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...state
	} = doc;
	return state;
}

/** Everyone who can play: not a watcher, not kicked, not left. */
async function presentPlayers(
	ctx: MutationCtx,
	doc: StateDoc,
): Promise<string[]> {
	const participants = await listParticipants(ctx, doc.sessionId);
	return participants
		.filter(
			(p) => p.role !== "watcher" && !p.kickedAt && !doc.left.includes(p._id),
		)
		.map((p) => p._id);
}

function packSize(state: ClockState) {
	return clockPackWords(state.packId, state.locale).length;
}

/** Loads the room, with kicked players already off their teams. */
async function load(ctx: MutationCtx, sessionId: SeatArgs["sessionId"]) {
	const { session, state: doc } = await loadGame(ctx, GAME, sessionId);
	const players = await presentPlayers(ctx, doc);
	return {
		session,
		doc,
		players,
		state: settleRoom(syncRoster(toRules(doc), players), Date.now()),
	};
}

/**
 * Stores the next state: starts or completes the session with it, and
 * schedules the timeout of a new deadline.
 */
async function save(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	doc: StateDoc,
	next: ClockState,
	now: number,
) {
	const patch = { ...next, updatedAt: now };
	if (next.phase === "finished" && doc.phase !== "finished") {
		const winners = next.winners.flatMap((team) =>
			teamMembers(next, team).map((m) => m.participantId),
		);
		await finishSession(ctx, doc, patch, {
			now,
			winners: winners.map(
				(id) => ctx.db.normalizeId("sessionParticipants", id) ?? undefined,
			),
		});
		return;
	}
	await ctx.db.patch(doc._id, patch);
	if (doc.phase === "lobby" && next.phase !== "lobby") {
		await startSession(ctx, session, now);
	}
	if (
		next.deadline !== undefined &&
		!next.paused &&
		next.deadline !== doc.deadline
	) {
		await ctx.scheduler.runAt(next.deadline, internal.beatTheClock.timeout, {
			sessionId: doc.sessionId,
			deadline: next.deadline,
		});
	}
}

/** A seated player's move: prove the seat, apply the rule, store it. */
async function play(
	ctx: MutationCtx,
	seat: SeatArgs,
	apply: (state: ClockState, now: number, players: string[]) => ClockState,
) {
	await requireOwnParticipant(ctx, seat);
	const { session, doc, players, state } = await load(ctx, seat.sessionId);
	const now = Date.now();
	await save(
		ctx,
		session,
		doc,
		rules(() => apply(state, now, players)),
		now,
	);
}

/** The host's move. */
async function host(
	ctx: MutationCtx,
	seat: SeatArgs,
	apply: (state: ClockState, now: number, players: string[]) => ClockState,
) {
	await requireHost(ctx, seat);
	const { session, doc, players, state } = await load(ctx, seat.sessionId);
	const now = Date.now();
	await save(
		ctx,
		session,
		doc,
		rules(() => apply(state, now, players)),
		now,
	);
}

export const create = mutation({
	args: {
		...hostedSessionArgs,
		packId: v.string(),
		locale: v.string(),
		turnSeconds: v.number(),
		target: v.number(),
		teamCount: v.number(),
	},
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		if (!isClockPackId(args.packId)) {
			throw gameError("clockBadPack");
		}
		const state = rules(() =>
			createClockState({
				packId: args.packId,
				locale: args.locale === "nl" ? "nl" : "en",
				turnSeconds: args.turnSeconds,
				target: args.target,
				teamCount: args.teamCount,
			}),
		);
		const hosted = await hostGame(ctx, GAME, args);
		const now = Date.now();
		await ctx.db.insert("beatTheClockStates", {
			sessionId: hosted.session._id,
			...state,
			createdAt: now,
			updatedAt: now,
		});
		return createdSession(hosted);
	},
});

export const pickTeam = mutation({
	args: { ...seatArgs, team: v.number() },
	handler: async (ctx, { team, ...seat }) => {
		const participant = await requireOwnParticipant(ctx, seat);
		if (participant.role === "watcher") {
			throw gameError("clockWrongPhase");
		}
		const { session, doc, state } = await load(ctx, seat.sessionId);
		const now = Date.now();
		await save(
			ctx,
			session,
			doc,
			rules(() => pickTeamRule(state, seat.participantId, team)),
			now,
		);
	},
});

export const shuffleTeams = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		host(ctx, seat, (state, _now, players) =>
			shuffleRule(state, players, Math.random),
		),
});

export const start = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		host(ctx, seat, (state, now, players) =>
			startGame(state, players, packSize(state), Math.random, now),
		),
});

export const goTurn = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		play(ctx, seat, (state, now) => go(state, seat.participantId, now)),
});

export const tick = mutation({
	args: { ...seatArgs, index: v.number(), guessed: v.boolean() },
	handler: (ctx, { index, guessed, ...seat }) =>
		play(ctx, seat, (state) =>
			tickRule(state, seat.participantId, index, guessed),
		),
});

export const send = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		play(ctx, seat, (state, now) => sendRule(state, seat.participantId, now)),
});

export const flagWord = mutation({
	args: { ...seatArgs, index: v.number(), flagged: v.boolean() },
	handler: (ctx, { index, flagged, ...seat }) =>
		play(ctx, seat, (state) => flag(state, seat.participantId, index, flagged)),
});

export const confirmCheck = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		play(ctx, seat, (state, now) => confirm(state, seat.participantId, now)),
});

export const next = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		play(ctx, seat, (state, now) => nextTurn(state, seat.participantId, now)),
});

export const seeWinner = mutation({
	args: seatArgs,
	handler: (ctx, seat) => play(ctx, seat, (state) => seeWinnerRule(state)),
});

export const extraRound = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		play(ctx, seat, (state, now) => startExtraRound(state, now)),
});

export const skip = mutation({
	args: seatArgs,
	handler: (ctx, seat) => host(ctx, seat, (state, now) => skipTurn(state, now)),
});

export const pause = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		host(ctx, seat, (state, now) => pauseRule(state, now)),
});

export const resume = mutation({
	args: seatArgs,
	handler: (ctx, seat) =>
		host(ctx, seat, (state, now) => resumeRule(state, now)),
});

export const end = mutation({
	args: seatArgs,
	handler: (ctx, seat) => host(ctx, seat, (state) => endGame(state)),
});

/** A player leaves the room; the host ends the game instead. */
export const leave = mutation({
	args: seatArgs,
	handler: async (ctx, seat) => {
		await requireOwnParticipant(ctx, seat);
		const { session, doc, state } = await load(ctx, seat.sessionId);
		if (session.hostParticipantId === seat.participantId) {
			throw gameError("clockHostCannotLeave");
		}
		const now = Date.now();
		await save(
			ctx,
			session,
			doc,
			rules(() => leaveRule(state, seat.participantId, now)),
			now,
		);
	},
});

/** Host, after a game: same teams (`newTeams` false) or back to the lobby to pick new ones. */
export const playAgain = mutation({
	args: { ...seatArgs, newTeams: v.boolean() },
	handler: async (ctx, { newTeams, ...seat }) => {
		await requireHost(ctx, seat);
		const { session, doc, players, state } = await load(ctx, seat.sessionId);
		if (state.phase !== "finished") {
			throw gameError("clockWrongPhase");
		}
		const now = Date.now();
		const next = rules(() =>
			rematch(state, players, packSize(state), Math.random, now, newTeams),
		);
		await reopenSession(ctx, session._id);
		// Reopened: the session is active again, so `save` only stores and schedules.
		await save(
			ctx,
			{ ...session, status: "active" },
			{ ...doc, phase: "lobby" },
			next,
			now,
		);
	},
});

/** The scheduled end of a timed phase. A stale one (paused, moved on) does nothing. */
export const timeout = internalMutation({
	args: { sessionId: v.id("gameSessions"), deadline: v.number() },
	handler: async (ctx, args) => {
		const { session, doc, state } = await load(ctx, args.sessionId);
		if (state.paused || state.deadline !== args.deadline) {
			return;
		}
		const now = Math.max(Date.now(), args.deadline);
		await save(ctx, session, doc, timeoutRule(state, now), now);
	},
});

/**
 * The room as one viewer sees it. The deal order never leaves the server, and
 * the turn's words reach only those who may see them now: the describer and
 * the referees while the clock runs, everyone once the words are sent. A
 * seat the caller cannot prove is theirs views as a watcher.
 */
export const getBundle = query({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.optional(v.id("sessionParticipants")),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const bundle = await loadBundle(ctx, GAME, args.sessionId);
		if (!bundle?.state) {
			return null;
		}
		const { session, participants, state: doc } = bundle;
		const viewer = args.participantId
			? await findOwnParticipant(ctx, {
					sessionId: args.sessionId,
					participantId: args.participantId,
					guestId: args.guestId,
				})
			: null;
		const state = toRules(doc);
		const role = clockRole(
			state,
			viewer?._id,
			!viewer || viewer.role === "watcher",
		);
		const words =
			state.turn && canSeeWords(state, role)
				? clockWords(state.packId, state.locale, state.turn.words)
				: null;
		const { deck, used: _used, turn, ...shared } = state;
		return {
			session,
			participants,
			viewerId: viewer?._id ?? null,
			state: {
				...shared,
				deckLeft: deck.length,
				packWillRunLow: packRunsLow(state, packSize(state)),
				turn: turn ? { ...turn, words: undefined } : undefined,
			},
			words,
		};
	},
});
